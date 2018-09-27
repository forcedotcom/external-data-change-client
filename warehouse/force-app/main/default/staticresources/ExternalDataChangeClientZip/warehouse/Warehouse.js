define(["channel/ServerConnection", "data/Data", "dojo/_base/declare", "dojo/number", "dojo/currency", "dojo/date/locale"],
        function(ServerConnection, Data, declare, number, currency, locale) {
    /**
     * A few dom helper functions
     */
    var dom = function(parentElement, childElementOrElements) {
        if (parentElement && typeof childElementOrElements === "object" && childElementOrElements !== null) {
            if (Array.isArray(childElementOrElements)) {
                childElementOrElements.forEach(function (childElement) {
                    parentElement.appendChild(childElement);
                })
            } else {
                parentElement.appendChild(childElementOrElements);
            }
        }
        return parentElement;
    };

    dom.el = function(name, attributes, childElementOrElements) {
        var element = document.createElement(name);
        if (typeof attributes === 'object' && attributes !== null) {
            Object.keys(attributes).forEach(function(key) {
                var attribute = document.createAttribute(key);
                attribute.value = attributes[key];
                element.setAttributeNode(attribute);
            });
        }
        return dom(element, childElementOrElements);
    };

    dom.text = function(name, text, attributes) {
        return dom.el(name, attributes, document.createTextNode(text));
    };

    dom.input = function(type, attributes) {
        return dom.el("input", Object.assign(attributes, {"type": type}));
    };

    dom.copyFrom = function(nodeId) {
        var node = document.getElementById(nodeId);
        if (node) {
            return node.cloneNode(true);
        }
        return dom.el("div");
    };

    dom.removeChildren = function(node) {
        var lastChild;
        while (lastChild = node.lastChild) {
            node.removeChild(lastChild);
        }
    };


    function formatCurrency(numberValue) {
        return currency.format(numberValue, {currency: "USD"});
    }

    /**
     * ProductDealData models product deals. The id is the product ID, the object is Product__x
     */
    var ProductDealData = declare(Data, {
        constructor: function(listener) {
            var self = this;
            Data.prototype.constructor.apply(this, [25, listener, function(leftId, rightId) {
                return self.getObjectTimestamp(rightId) - self.getObjectTimestamp(leftId);
            }]);
        }
    });

    /**
     * Models the current order data. The id is the product id to order, the data is the quantity of items to order
     */
    var ShoppingCartData = declare(Data, {
        _productDeals: null,
        _validations: null,

        /**
         * @param {ProductDealData} productDealData product deals
         * @param {DataChangeListener} listener
         */
        constructor: function(productDealData, listener) {
            Data.prototype.constructor.apply(this, [-1, listener, null]);
            this._productDeals = productDealData;
            this._validations = {};
        },

        /**
         * @param id id is the product id to add
         * @param object object is the quantity of product items to order
         * @param timestamp
         */
        add: function(id, object, timestamp) {
            var product = this._productDeals.get(id);
            if (!product) {
                return;
            }

            if (object > product.OrderLimit__c) {
                this._validations[id] = "Quantity exceeds order limit";
            } else {
                delete this._validations[id];
            }

            return this.inherited(arguments);
        },

        /**
         * @returns {boolean} true if items in shopping cart are all valid, false otherwise
         */
        isValid: function() {
            return Object.keys(this._validations).length === 0;
        },

        /**
         * @param id product id
         * @returns {string|null} validation string if this product id order has a validation error, null otherwise
         */
        getValidationMessage: function(id) {
            return this._validations[id] || null;
        }
    });


    return declare(null, {
        _serverConnection: null,
        _productChannel: null,
        _orderChannel: null,

        constructor: function(serverUrl, apiVersion, apiSessionId, username, warehouseObjects) {
            this._serverConnection = new ServerConnection(serverUrl, function() {return apiSessionId;}, apiVersion);

            this._serverConnection.addListener({
                messageSent: function (messageType, message) {
                    var statusLine = document.getElementById("status-id");
                    if (statusLine) {
                        statusLine.innerText = messageType + ": " + message;
                    }
                },
                onConnected: function(message) {
                    this.messageSent("Connected", message);
                },
                onDisconnected: function(message) {
                    this.messageSent("Disconnected", message);
                },
                onHandshake: function(message) {
                    this.messageSent("Handshake", message);
                },
                onSubscribe: function(message) {
                    this.messageSent("Subscribe", message);
                },
                onUnsubscribe: function(message) {
                    this.messageSent("Unsubscribe", message);
                },
                onFailure: function(message) {
                    this.messageSent("Failure", message);
                }
            });

            this._productChannel = {
                name: "/data/Products__ChangeEvent",
                replayFrom: -2,
                changeEventListener: {
                    updated: function (timestamp, entityName, recordId, object) {
                        // TODO: To get unchanged field details, query objects first.
                        // Filtering out now as sample provider sends all fields on changes
                        if (object && object.Name__c) {
                            productDeals.add(recordId, object, timestamp);
                        }
                    },
                    created: function (timestamp, entityName, recordId, object) {
                        // TODO: To get unchanged field details, query objects first.
                        // Filtering out now as sample provider sends all fields on changes
                        if (object && object.Name__c) {
                            productDeals.add(recordId, object, timestamp);
                        }
                    },
                    deleted: function (timestamp, entityName, recordId, object) {
                        productDeals.remove(recordId);
                    }
                }
            };

            this._orderChannel = {
                name: "/data/ProductOrders__ChangeEvent",
                replayFrom: -2,
                changeEventListener: {
                    updated: function(timestamp, entityName, recordId, object) {
                        updateSubmittedOrders();
                    },
                    created: function(timestamp, entityName, recordId, object) {
                        updateSubmittedOrders();
                    },
                    deleted: function(timestamp, entityName, recordId, object) {
                        updateSubmittedOrders();
                    }
                }
            };

            function showProductDeal(products, productId, updatedOn, name, description, inStock, orderLimit, unitPrice, transition) {
                var trId = "tr-" + productId;

                function trAttributes() {
                    var attributes = {
                        id: trId
                    };
                    if (transition) {
                        attributes.style = "background-color: #c23934; transition: background-color 3s";
                    }
                    return attributes;
                }
                function tdAttributes(attributes) {
                    if (attributes === undefined) {
                        attributes = {};
                    }
                    if (transition) {
                        attributes.style = "color: white; transition: color 3s";
                    }
                    return attributes;
                }

                var table = document.getElementById("products-id");
                if (table) {
                    dom(table, dom.el("tbody", {}, dom.el("tr", trAttributes(), [
                        dom.text("td", updatedOn, tdAttributes()),
                        dom.el("td", tdAttributes(),
                            dom.el("div", {style: "display: block;"}, [
                                dom.text("div", name, {style: "display: inline"}),
                                dom.el("div", {class: "slds-form-element", style: "display: inline; margin-left: 5px"},
                                    dom.el("div", {class: "slds-form-element__icon slds-align-middle"},
                                        dom.el("button", {id: "tooltip-" + productId,
                                                onclick: "warehouse.toggleTooltip('tooltip-" + productId +
                                                    "', \"" + description.replace('"', '\\"') + "\")",
                                                class: "slds-button slds-button_icon slds-button slds-button_icon",
                                                title: "Help"}, [
                                            dom.copyFrom("icon-info-cp"),
                                            dom.text("span", "Help", {class: "slds-assistive-text"})
                                        ])
                                    )
                                )
                            ])
                        ),
                        dom.text("td", inStock, tdAttributes()),
                        dom.text("td", orderLimit, tdAttributes()),
                        dom.text("td", formatCurrency(unitPrice), tdAttributes()),
                        dom.el("td", {},
                            dom.el("div", {class: "slds-form-element"}, [
                                dom.el("div", {class: "slds-form-element__control"}, [
                                    dom.copyFrom("icon-warning-cp"),
                                    addOrderQuantityChangedActions(productId, dom.input("text",
                                        {id: "quantity-id-" + productId, class: "slds-input", placeholder: 0, required: ""}))
                                ]),
                                dom.el("div", {class: "slds-form-element__help", style: "display: none;"})
                            ])
                        ),
                        dom.text("td", formatCurrency("0"), tdAttributes({id: "td-total-price-id-" + productId}))
                    ])));

                    if (transition) {
                        setTimeout(function() {
                           var tr = document.getElementById(trId);
                           if (tr) {
                               tr.style["background-color"] = "";
                               for (var i = 0; i < tr.children.length; i++) {
                                   var child = tr.children[i];
                                   if (child.nodeName.toLowerCase() === "td") {
                                       child.style["color"] = "";
                                   }
                               }
                           }
                        }, 3000);
                    }
                }
            }

            var productDealsListener = {
                updated: function (products, productId, product) {
                    var self = this;
                    if (!self.updating) {
                        self.updating = true;
                        setTimeout(function () {
                            productDealsListener.doUpdate(products, productId, product);
                            self.updating = false;
                        }, 200);
                    }
                },

                doUpdate: function(products, productId, product) {
                    // Clear current products
                    var table = document.getElementById("products-id");
                    while (table && table.children.length > 1) {
                        table.removeChild(table.children[1]);
                    }

                    // Updates the full list of product deals
                    var count = 0;
                    var now = Date.now();
                    products.forEach(function(productId, product) {
                        // Transition if recent update event
                        var updatedOnTimestamp = products.getObjectTimestamp(productId);
                        var transition = (now - updatedOnTimestamp < 5000);

                        if (count < 50) {
                            var updatedOn = products.getObjectLocalDateTime(productId);
                            showProductDeal(products, productId, updatedOn, product.Name__c, product.Description__c,
                                product.Stock__c, product.OrderLimit__c, currency.format(product.UnitPrice__c), transition);
                            count = count + 1;
                        }
                    });

                    var dealsCount = document.getElementById("products-count");
                    if (dealsCount) {
                        dealsCount.innerText = (count > 0 ? "Showing " + count + " deals": "No deals found");
                    }

                    // Update table with shopping cart
                    shoppingCartListener.updated(shoppingCart);
                }
            };
            productDealsListener.added = productDealsListener.updated;
            productDealsListener.removed = productDealsListener.updated;
            var productDeals = new ProductDealData(productDealsListener);

            function addOrderQuantityChangedActions(productId, inputElement) {
                require(["dojo/on"], function(on) {
                    function onQuantityChanged(event) {
                        var input = document.getElementById("quantity-id-" + productId);
                        if (input) {
                            var value = input.value ? Number.parseInt(input.value) : 0;
                            if (Number.isNaN(value)) {
                                input.value = (input.oldValue ? input.oldValue : 0);
                            } else {
                                if (!value && event && event.type === "focus") {
                                    setTimeout(function() {
                                        if (input.setSelectionRange) {
                                            input.setSelectionRange(1, 1);
                                        }
                                    });
                                }
                                input.value = value;
                                if (input.oldValue !== value) {
                                    input.oldValue = value;
                                    shoppingCart.add(productId, value, Date.now());
                                }
                            }
                        }
                    }
                    on(inputElement, ["focus","change","keypress","input","paste"], onQuantityChanged);
                });
                return inputElement;
            }

            function showProductDealValidationError(productId, errorMessage) {
                var input = document.getElementById("quantity-id-" + productId);
                if (input) {
                    var div = input.parentElement;
                    div.classList.add("slds-input-has-icon");
                    div.classList.add("slds-input-has-icon_left");
                    div.children[0].style = "display: block";
                    div.parentElement.classList.add("slds-has-error");
                    dom.removeChildren(div.parentElement.children[1]);
                    div.parentElement.children[1].appendChild(document.createTextNode(errorMessage));
                    div.parentElement.children[1].style = "display: block";
                }
            }

            function clearProductDealValidationError(productId) {
                var input = document.getElementById("quantity-id-" + productId);
                if (input) {
                    var div = input.parentElement;
                    div.classList.remove("slds-input-has-icon");
                    div.classList.remove("slds-input-has-icon_left");
                    div.children[0].style = "display: none";
                    div.parentElement.classList.remove("slds-has-error");
                    div.parentElement.children[1].style = "display: none";
                    dom.removeChildren(div.parentElement.children[1]);
                }
            }

            var lastPlaceOrderErrorMessage = null;
            function placeOrder() {
                var ordersToPlace = [];
                var productIds = {};
                shoppingCart.forEach(function(productId, quantity) {
                    var externalProductId = productDeals.get(productId).ProductId__c;
                    var productName = productDeals.get(productId).Name__c;
                    productIds[externalProductId] = productId;
                    ordersToPlace.push({
                        CustomerName__c: username,
                        ProductId__c: externalProductId,
                        ProductName__c: productName,
                        AskedQuantity__c: quantity
                    });
                });
                ordersToPlace.forEach(function(orderToPlace) {
                    var productOrder = new warehouseObjects.ProductOrders();
                    productOrder.create(orderToPlace, function(error) {
                       if (error) {
                           var p = document.getElementById("total-price-id");
                           if (p) {
                               lastPlaceOrderErrorMessage = error.message;
                               p.innerText = lastPlaceOrderErrorMessage;
                               p.classList.add("slds-text-color_error");
                           }
                       } else {
                           updateSubmittedOrders();
                       }
                    });
                    shoppingCart.remove(productIds[orderToPlace.ProductId__c]);
                });
            }

            function updateTotalPrice(price) {
                var p = document.getElementById("total-price-id");
                if (p) {
                    if (price > 0 || lastPlaceOrderErrorMessage === null) {
                        p.innerText = (price > 0 ? "Order Total: " + formatCurrency(price) : "No order to place");
                        p.classList.remove("slds-text-color_error");
                        lastPlaceOrderErrorMessage = null;
                    }
                }
            }

            function updatePlaceOrderAction(active) {
                var button = document.getElementById("place-order-id");
                if (button) {
                    button.disabled = !active;

                    if (active) {
                        require(["dojo/on"], function(on) {
                            on(button, ["click"], placeOrder);
                        });
                    }
                }
            }

            function updateSubTotalPrice(productId, price) {
                var td = document.getElementById("td-total-price-id-" + productId);
                if (td) {
                    td.innerText = formatCurrency(price);
                }
            }

            function updateProductQuantity(productId, quantity) {
                var input = document.getElementById("quantity-id-" + productId);
                if (input) {
                    input.value = quantity;
                }
            }

            var shoppingCartListener = {
                updated: function(shoppingCart, productId, quantity) {
                    function updateProductDealRow(productId, quantity) {
                        var subPrice= 0;
                        updateProductQuantity(productId, quantity);
                        if (!shoppingCart.isValid()) {
                            var errorMessage = shoppingCart.getValidationMessage(productId);
                            if (errorMessage !== null) {
                                showProductDealValidationError(productId, errorMessage);
                            } else {
                                clearProductDealValidationError(productId);
                            }
                        } else {
                            subPrice = quantity * shoppingCart._productDeals.get(productId).UnitPrice__c;
                            totalPrice += subPrice;
                            clearProductDealValidationError(productId);
                        }
                        updateSubTotalPrice(productId, subPrice);
                    }

                    var totalPrice = 0;
                    shoppingCart.forEach(updateProductDealRow);
                    if (quantity === 0) {
                        updateProductDealRow(productId, quantity);
                    }

                    updateTotalPrice(totalPrice);
                    updatePlaceOrderAction(shoppingCart.isValid() && totalPrice > 0);
                },

                removed: function(shoppingCard, productId, oldQuantity) {
                    this.updated(shoppingCart, productId, 0);
                }
            };
            shoppingCartListener.added = shoppingCartListener.updated;
            var shoppingCart = new ShoppingCartData(productDeals, shoppingCartListener);


            function updateSubmittedOrders() {
                function addSubmittedOrder(placeOrdersDiv, orderTitle, orderDetails) {
                    dom(placeOrdersDiv,
                        dom.el("article", {class: "slds-card slds-card--narrow"}, [
                            dom.el("div", {class: "slds-card__header slds-grid"},
                                dom.el("header", {class: "slds-media slds-media--center slds-has-flexi-truncate"}, [
                                    dom.el("div", {class: "slds-media__figure"},
                                        dom.copyFrom("icon-orders-cp")
                                    ),
                                    dom.el("div", {class: ""},
                                        dom.text("h2", orderTitle, {class: "slds-text-heading__medium"})
                                    )
                                ])
                            ),
                            dom.el("div", {class: "slds-card__body"},
                                dom.el("div", {class: "slds-card__body--inner"},
                                    dom.el("div", {class: "slds-tile"},
                                        dom.el("div", {class: "slds-tile__detail slds-text-body--small"},
                                            orderDetails.map(function(detail) {
                                                return dom.el("dl", {class: "slds-list--horizontal slds-wrap"}, [
                                                    dom.text("dt", detail.name, {class: "slds-item--label slds-text-color--weak slds-truncate", title: detail.name}),
                                                    dom.text("dt", detail.value, {class: "slds-item--detail slds-truncate", title: detail.value})
                                                ]);
                                            })
                                        )
                                    )
                                )
                            )
                        ])
                    );
                }

                var productOrder = new warehouseObjects.ProductOrders();
                productOrder.retrieve({
                        where: {CustomerName__c: {eq: username}},
                        orderby: [{ProductOrderId__c: "DESC"}],
                        limit: 3
                    }, function(error, records) {
                        var placedOrdersDiv = document.getElementById("placed-orders");
                        if (!placedOrdersDiv) {
                            return;
                        }
                        dom.removeChildren(placedOrdersDiv);
                        if (error) {
                           var p = document.getElementById("status-id");
                           if (p) {
                               p.innerText = "Could not get placed order list: " + error.message;
                               p.classList.add("slds-text-color_error");
                           }
                        } else {
                            records.forEach(function(record) {
                                addSubmittedOrder(placedOrdersDiv, record.get("ProductOrderId__c"), [{
                                    name: "Product", value: record.get("ProductName__c")
                                }, {
                                    name: "Asked", value: record.get("AskedQuantity__c")
                                }, {
                                    name: "Ordered", value: record.get("Quantity__c")
                                }, {
                                    name: "On", value: locale.format(record.get("OrderedOn__c"))
                                }, {
                                    name: "Price", value: formatCurrency(record.get("OrderPrice__c"))
                                }])
                            });
                        }
                });
            }

            // Initialize placed orders
            updateSubmittedOrders();
        },

        subscribe: function() {
            this._serverConnection.subscribe(this._productChannel);
            //this._serverConnection.subscribe(this._orderChannel);

            if (!this._serverConnection.isConnected()) {
                this._serverConnection.connect();
            }
        },

        unsubscribe: function() {
            this._serverConnection.unsubscribe(this._productChannel.name);
            //this._serverConnection.unsubscribe(this._orderChannel.name);

            if (this._serverConnection.isConnected()) {
                this._serverConnection.disconnect();
            }
        },

        placeTooltip: function(tooltipOwnerId) {
            if (!tooltipOwnerId) {
                tooltipOwnerId = this._tooltipOwnerId;
            }
            this._tooltipOwnerId = tooltipOwnerId;

            var tooltip = document.getElementById("tooltip");
            if (tooltip) {
                var tooltipOwner = document.getElementById(tooltipOwnerId);
                if (tooltipOwner) {
                    var tooltipOwnerRectangle = tooltipOwner.getBoundingClientRect();
                    if (tooltipOwnerRectangle) {
                        var leftAdjust = 0;
                        var topAdjust = 0;
                        var warehousePanel = document.getElementById("warehouse-panel");
                        if (warehousePanel) {
                            var rect = warehousePanel.getBoundingClientRect();
                            if (rect) {
                                leftAdjust = rect.left;
                                topAdjust = rect.top;
                            }
                        }
                        tooltip.style.left = (tooltipOwnerRectangle.left - 15 - leftAdjust) + "px";
                        tooltip.style.top = (tooltipOwnerRectangle.bottom + 15 - topAdjust) + "px";
                    }
                }
            }
        },

        toggleTooltip: function(tooltipOwnerId, tooltipText) {
            var tooltip = document.getElementById("tooltip");
            if (tooltip) {
                // Make the tooltip show if either the text changes or the tooltip has been toggled
                var tooltipTextDiv = document.getElementById("tooltip-text");
                if (tooltipTextDiv) {
                    if (tooltipTextDiv.innerText === tooltipText) {
                        tooltipText = "";
                    }
                }

                // Show tooltip if it has text set
                if (tooltipText) {
                    tooltipTextDiv.innerText = tooltipText;
                    tooltip.classList.add("slds-rise-from-ground");
                    tooltip.classList.remove("slds-fall-into-ground");
                    this.placeTooltip(tooltipOwnerId);

                // Hide tooltip if there is no help text
                } else {
                    tooltip.classList.add("slds-fall-into-ground");
                    tooltip.classList.remove("slds-rise-from-ground");
                    tooltipTextDiv.innerText = "";
                }
            }
        }
    });
});
