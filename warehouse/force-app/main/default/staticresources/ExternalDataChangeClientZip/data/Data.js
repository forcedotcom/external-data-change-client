define(["dojo/_base/declare", "dojo/date/locale"], function(declare, locale) {
    /**
     * @typedef {Object} DataChangeListener
     * @property {ObjectVisitor} updated called when the data has been updated
     * @property {ObjectVisitor} added called when a new object has been added
     * @property {ObjectVisitor} removed called when an object has been removed
     *
     * @typedef {Function} ObjectVisitor
     * @param {Data} data the data store where the change happened
     * @param {string} id the id of the changed object
     * @param {Object} object the object that has been changed
     *
     * @typedef {Function} Sorter
     * @param {Object} leftId left id to compare
     * @param {Object} rightId right id to compare
     * @returns {integer} negative integer value if left is less than right, 0 if both are equal and positive if
     * left is greater than right.
     */

    return declare(null, {
        _size: -1,
        _data: null,
        _sortedIds: null,
        _timestamps: null,
        _listener: null,
        _sorter: null,

        /**
         * @param {integer} [size=-1] -1 if unlimited, otherwise size of objects to keep. Objects from sorted criteria will be dropped first
         * @param {DataChangeListener} listener listener to call when objects have been updated, added or removed
         * @param {?Sorter} sorter optional sort function for keeping objects sorted. If not set, then data is sorted based on the
         * order they have been added.
         */
        constructor: function(size, listener, sorter) {
            this._size = size;
            this._data = {};
            this._sortedIds = [];
            this._timestamps = {};
            this._listener = listener;
            this._sorter = sorter;
        },

        /**
         * Add a new object. If the id already exists, then the existing object is updated with the new one. If
         * a sorter is set, then the new object is sorted accordingly.
         * @param {Object} id unique id of the object
         * @param {Object} object object to add
         * @param {?number} timestamp optional timestamp, if not set, it is now
         * @returns {?Object} added or updated object, undefined if none added.
         */
        add: function (id, object, timestamp) {
            if (this._size === 0) {
                return undefined;
            }
            if (!timestamp) {
                timestamp = Date.now();
            }

            if (this._size !== -1 && this._sortedIds.length > this._size) {
                var idToDrop = this._sortedIds[this._sortedIds.length - 1];
                delete this._data[idToDrop];
            }
            this._data[id] = object;
            this._timestamps[id] = timestamp;

            var added = false;
            if (this._sortedIds.indexOf(id) === -1) {
                this._sortedIds.push(id);
                added = true;
            }
            if (this._sorter) {
                this._sortedIds.sort(this._sorter);
            }

            if (this._listener) {
                if (added) {
                    this._listener.added(this, id, object);
                } else {
                    this._listener.updated(this, id, object);
                }
            }

            return object;
        },

        /**
         * Remove the object for the given id
         * @param {Object} id the id for the object entry to remove
         * @returns {?Object} the removed object or undefined if not found
         */
        remove: function (id) {
            var object = this._data[id];

            if (object !== undefined) {
                delete this._data[id];
                this._sortedIds.splice(this._sortedIds.indexOf(id), 1);

                if (this._listener) {
                    this._listener.removed(this, id, object);
                }
            }

            return object;
        },

        /**
         * Remove all objects in the current order
         */
        removeAll: function() {
            this._sortedIds.forEach(this.remove, this);
        },

        /**
         * @param {Object} id object to get for the given id
         * @returns {?Object} found object or undefined if none
         */
        get: function(id) {
            return this._data[id];
        },

        /**
         * @param id the object id
         * @returns {?number} the object's timestamp in milliseconds since epoch or undefined if no object
         */
        getObjectTimestamp: function(id) {
            return this._timestamps[id];
        },

        /**
         * @param id the object id
         * @returns {?string} the object's timestamp in the local default date time format or undefined if not found
         */
        getObjectLocalDateTime: function(id) {
            var timestamp = this.getObjectTimestamp(id);
            return timestamp ? locale.format(new Date(timestamp)) : undefined;
        },

        /**
         * @param id the object id
         * @returns {number} the object's sort order if found, -1 otherwise
         */
        indexOf: function(id) {
            return this._sortedIds.indexOf(id);
        },

        /**
         * @param {ObjectVisitor} fn calls fn for each object in the data store in the given order
         */
        forEach: function(fn) {
            var self = this;
            this._sortedIds.forEach(function(id) {
                fn.apply(self, [id, self.get(id)]);
            });
        }
    });
});