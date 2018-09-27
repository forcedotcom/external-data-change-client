define(["dojo", "dojox/cometd", "dojo/_base/declare"], function(dojo, cometd, declare) {
    /**
     * @callback ServerSessionIdToken
     * @returns {string} current valid session id token
     */

    /**
     * @typedef {Object} ServerMetaEventListener
     * @property {OnMetaEvent} onConnected called when connected to the server
     * @property {OnMetaEvent} onDisconnected called when disconnected
     * @property {OnMetaEvent} onHandshake handshake status callback
     * @property {OnMetaEvent} onSubscribe called when a channel has been subscribed
     * @property {OnMetaEvent} onUnsubscribe called when a channel has been unsubscribed
     * @property {OnMetaEvent} onFailure called on general failure
     *
     * @typedef {Function} OnMetaEvent
     * @param {Object} event Bayeux event object with message details
     */

    /**
     * @typedef {Object} Channel
     * @property {string} name channel name
     * @param {int} [replayFrom=-1] replay events: -1 now; -2 since 24 hours ago; >= 0: after given replay number
     * @param {ChangeEventListener} changeEventListener change event listener to call back on receipt of a change
     * event on this channel. Null if no callback
     */

    /**
     * @typedef {Object} ChangeEventListener
     * @property {OnChangeEvent} updated the object has been updated
     * @property {OnChangeEvent} created the object has been created
     * @property {OnChangeEvent} updated the object has been deleted
     *
     * @typedef {Function} OnChangeEvent
     * @param {number} timestamp the time of the change event
     * @param {string} entityName the name of the Salesforce entity
     * @param {string} id the Salesforce id of the object
     * @param {string} changeObject the changed object with the changed field values
     */

    var CometdReplayExtension = declare(null, {
        _serverConnection: null,

        constructor: function(serverConnection) {
            this._serverConnection = serverConnection;
        },

        registered: function(name, cometd) {
        },

        incoming: function(message) {
            if (message.channel === "/meta/handshake") {
                if (message.ext && message.ext["replay"] === true) {
                    this._serverConnection._replayExtensionEnabled = true;
                }
            }
        },

        outgoing: function(message) {
            if (message.channel === "/meta/subscribe") {
                if (this._serverConnection._replayExtensionEnabled) {
                    if (!message.ext) {
                        message.ext = {};
                    }
                    var self = this;
                    var replay = {};
                    Object.keys(self._serverConnection._channels).forEach(function(name) {
                        var channel = self._serverConnection._channels[name];
                        replay[name] = channel.replayFrom;
                    });
                    message.ext["replay"] = replay;
                }
            }
        }
    });

    return declare(null, {
        _cometd: cometd,

        _cometdServerRootUrl: "",
        _cometdServerSessionIdTokenFn: function() {return "";},
        _cometdServerApiVersion: "41.0",

        _replayExtensionName: "ReplayFrom",
        _replayExtensionEnabled: true,

        _connected: false,

        _metaConnectListener: null,
        _metaDisconnectListener: null,
        _metaHandshakeListener: null,
        _metaSubscribeListener: null,
        _metaUnsubscribeListener: null,
        _metaUnsuccessfulListener: null,

        _serverMetaEventListeners: [],

        _channels: {},
        _subscriptions: {},

        /**
         * @param {!string} serverRootUrl Salesforce server root URL to connect to
         * @param {ServerSessionIdToken} serverSessionIdTokenFn function to call to get the valid Salesforce session id token
         * @param {string} [serverApiVersion="41.0"] Salesforce server API version, defaults to 41.0
         * @param {string} [replayExtensionName="ReplayFrom"] unique replay extension name or null if no replay extension to register
         * @param {Object} [theCometd=cometd] cometd instance - if null default dojox.cometd is taken
         */
        constructor: function(serverRootUrl, serverSessionIdTokenFn, serverApiVersion, replayExtensionName, theCometd) {
            this._cometdServerRootUrl = serverRootUrl;
            if (serverSessionIdTokenFn !== undefined) {
                this._cometdServerSessionIdTokenFn = serverSessionIdTokenFn;
            }
            if (serverApiVersion !== undefined) {
                this._cometdServerApiVersion = serverApiVersion;
            }
            if (replayExtensionName !== undefined) {
                this._replayExtensionName = replayExtensionName;
            }
            if (theCometd !== undefined) {
                this._cometd = theCometd;
            }
        },

        /**
         * Add a listener to get server meta events
         * @param {ServerMetaEventListener} serverMetaEventListener
         * @returns {ServerMetaEventListener}
         */
        addListener: function(serverMetaEventListener) {
            this._serverMetaEventListeners.push(serverMetaEventListener);
            return serverMetaEventListener;
        },

        /**
         * Remove server meta event listener
         * @param {ServerMetaEventListener} listener
         * @returns {ServerMetaEventListener} listener or null if not found
         */
        removeListener: function(listener) {
            var size = this._serverMetaEventListeners.length;
            this._serverMetaEventListeners = this._serverMetaEventListeners.filter(function(l) {
                return l !== listener;
            });
            return (size !== this._serverMetaEventListeners.length) ? listener : null;
        },

        /**
         * Subscribe to the given channel
         * @param {Channel} channel channel to subscribe to
         * @return {Channel} subscribed to channel or null if not valid
         */
        subscribe: function(channel) {
            if (channel.name) {
                this.unsubscribe(channel.name);
                this._channels[channel.name] = channel;
                this._subscribeChannels();
                return channel;
            }
            return null;
        },

        /**
         * Unsubscribe the channel with the given channel name
         * @param {string} channelName channel name to unsubscribe
         * @return {Channel} unsubscribed channel or null if none
         */
        unsubscribe: function(channelName) {
            var channel = this._channels[channelName];
            var subscription = this._subscriptions[channelName];
            if (subscription) {
                if (this.isConnected()) {
                    this._cometd.unsubscribe(subscription);
                }
                delete this._subscriptions[channelName];
                delete this._channels[channelName];
            }
            return channel || null;
        },

        isSubscribed: function(channelName) {
            return this._subscriptions[channelName] !== undefined;
        },

        /**
         * Connect to server
         */
        connect: function() {
            if (this.isConnected()) {
                return;
            }

            var self = this;
            var cometd = this._cometd;

            function onMetaEvent(metaEventName, message) {
                self._serverMetaEventListeners.forEach(function(listener) {
                    if (listener["on" + metaEventName]) {
                        listener["on" + metaEventName](message);
                    }
                });
            }

            function onConnected(message) {
                self._connected = true;
                self._subscribeChannels();
                onMetaEvent("Connected", message);
            }

            function onDisconnected(message) {
                self._unsubscribeChannels();
                self._removeMetaEventListeners();
                self._connected = false;
                onMetaEvent("Disconnected", message);
            }

            // Remove existing replay extension and register durable generic streaming replayFrom extension
            if (this._replayExtensionName) {
                cometd.unregisterExtension(this._replayExtensionName);
                var replayExtension = new CometdReplayExtension(this);
                cometd.registerExtension(this._replayExtensionName, replayExtension);
            }

            // Unsubscribe if already subscribed
            this._unsubscribeChannels();

            if (!this._metaConnectListener) {
                this._metaConnectListener = cometd.addListener("/meta/connect", function(message) {
                    if (cometd.isDisconnected()) {
                        onDisconnected(message);
                    } else if (!self.isConnected() && message.successful) {
                        onConnected(message);
                    } else if (self.isConnected() && !message.successful) {
                        onDisconnected(message);
                    }
                });
            }

            if (!this._metaDisconnectListener) {
                this._metaDisconnectListener = cometd.addListener("/meta/disconnect", function(message) {
                    onDisconnected(message);
                });
            }

            if (!this._metaHandshakeListener) {
                this._metaHandshakeListener = cometd.addListener("/meta/handshake", function(message) {
                    if (message.successful) {
                        if (message.ext && message.ext["replay"] === true) {
                            self._replayExtensionEnabled = true;
                        }
                    }
                    onMetaEvent("Handshake", message);
                });
            }

            if (!this._metaSubscribeListener) {
                this._metaSubscribeListener = cometd.addListener("/meta/subscribe", function(message) {
                    onMetaEvent("Subscribe", message);
                });
            }

            if (!this._metaUnsubscribeListener) {
                this._metaUnsubscribeListener = cometd.addListener("/meta/unsubscribe", function(message) {
                    onMetaEvent("Unsubscribe", message);
                });
            }

            if (!this._metaUnsuccessfulListener) {
                this._metaUnsuccessfulListener = cometd.addListener("/meta/unsuccessful", function(message) {
                    onMetaEvent("Failure", message.error || message);
                });
            }

            cometd.websocketEnabled = false;

            cometd.configure({
                url: self._cometdServerRootUrl + "/cometd/" + self._cometdServerApiVersion,
                requestHeaders: {
                    Authorization: "OAuth " + self._cometdServerSessionIdTokenFn()
                }
            });

            cometd.handshake();
        },

        /**
         * Disconnect from server
         */
        disconnect: function() {
            if (this.isConnected()) {
                this._cometd.disconnect();
                this._connected = false;
            }
        },

        /**
         * @returns {boolean} true if connected to server, false otherwise
         */
        isConnected: function() {
            return this._connected;
        },

        _removeMetaEventListeners: function() {
            if (this._metaConnectListener) {this._cometd.removeListener(this._metaConnectListener);}
            if (this._metaDisconnectListener) {this._cometd.removeListener(this._metaDisconnectListener);}
            if (this._metaHandshakeListener) {this._cometd.removeListener(this._metaHandshakeListener);}
            if (this._metaSubscribeListener) {this._cometd.removeListener(this._metaSubscribeListener);}
            if (this._metaUnsubscribeListener) {this._cometd.removeListener(this._metaUnsubscribeListener);}
            if (this._metaUnsuccessfulListener) {this._cometd.removeListener(this._metaUnsuccessfulListener);}

            this._metaConnectListener = null;
            this._metaDisconnectListener = null;
            this._metaHandshakeListener = null;
            this._metaSubscribeListener = null;
            this._metaUnsubscribeListener = null;
            this._metaUnsuccessfulListener = null;
        },

        _subscribeChannels: function() {
            var self = this;
            if (self.isConnected()) {
                Object.keys(self._channels).forEach(function(name) {
                    var channel = self._channels[name];
                    self._subscriptions[name] = self._cometd.subscribe(name, function(event) {
                        if (channel.changeEventListener && event && event.data && event.data.payload && event.data.payload.ChangeEventHeader) {
                            var header = event.data.payload.ChangeEventHeader;
                            var entityName = header.entityName;
                            var recordId = header.recordIds[0];
                            var timestamp = header.commitTimestamp;
                            var changeType = header.changeType;
                            var changeObject = Object.assign({}, event.data.payload);
                            delete changeObject.ChangeEventHeader;

                            var changeTypeFnName;
                            switch (changeType) {
                                case "UPDATE": changeTypeFnName = "updated"; break;
                                case "CREATE": changeTypeFnName = "created"; break;
                                case "DELETE": changeTypeFnName = "deleted"; break;
                            }
                            if (typeof channel.changeEventListener[changeTypeFnName] === "function") {
                                channel.changeEventListener[changeTypeFnName](timestamp, entityName, recordId, changeObject);
                            }
                        }
                    });
                });
            }
        },

        _unsubscribeChannels: function() {
            var self = this;
            Object.keys(this._subscriptions).forEach(function(name) {
                self.unsubscribe(name);
            });
        }
    });
});

