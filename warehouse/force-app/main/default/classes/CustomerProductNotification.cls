public with sharing class CustomerProductNotification {
    private Integer stockThreshold;
    
    public CustomerProductNotification() {
        this.stockThreshold = 10;
    }
    
    public CustomerProductNotification(Integer stockThreshold) {
        this.stockThreshold = stockThreshold;
    }
    
    @future (callout=true)
    public static void orderOnLowOnStockProductUpdatesFuture(Set<Id> productIds) {
        CustomerProductNotification notification = new CustomerProductNotification();
        notification.orderOnLowOnStockProductUpdates(productIds);
    }
    
    public void orderOnLowOnStockProductUpdates(Set<Id> productIds) {
        if (!canAccessCustomer()) {
            return;
        }
    
        List<Customer__c> customers = [SELECT Name__c, Notify_By__c,
            SMS_Phone_Number__c, Twilio_From_Phone_Number__c 
            FROM Customer__c 
            WHERE Order_On_Low_Deals__c = TRUE];
            
        List<Products__x> products = getProductsLowOnStock(productIds);
        
        if (customers.size() > 0 && products.size() > 0) {
            // Only order if the customer has not ordered the product yet
            Map<String, Set<String>> productsToOrderForCustomers = new Map<String, Set<String>>();
            Set<String> customerNames = new Set<String>();
            Set<String> filteredProductIds = new Set<String>();
            for (Products__x p: products) {
                filteredProductIds.add(String.valueOf(p.ProductId__c.intValue()));
            }
            for (Customer__c c: customers) {
                customerNames.add(c.Name__c);
                productsToOrderForCustomers.put(c.Name__c, new Set<String>(filteredProductIds));
            }
            List<ProductOrders__x> orders = [SELECT CustomerName__c, ProductId__c
                FROM ProductOrders__x
                WHERE CustomerName__c IN :customerNames AND ProductId__c IN :filteredProductIds];
            for (ProductOrders__x order: orders) {
                productsToOrderForCustomers.get(order.CustomerName__c).remove(order.ProductId__c);
            }
            
            // Order 1 item from the product low on stock
            List<ProductOrders__x> productsToOrder = new List<ProductOrders__x>();
            for (String customerName: productsToOrderForCustomers.keySet()) {
                Set<String> ps = productsToOrderForCustomers.get(customerName);
                for (String p: ps) {
                    ProductOrders__x po = new ProductOrders__x();
                    po.AskedQuantity__c = 1;
                    po.ProductId__c = p;
                    po.CustomerName__c = customerName;
                    productsToOrder.add(po);
                }
            }
            Database.insertAsync(productsToOrder);
        }
    }
            
    @future (callout=true)
    public static void notifyOnProductUpdatesFuture(Set<Id> productIds) {
        CustomerProductNotification notification = new CustomerProductNotification();
        notification.notifyOnProductUpdates(productIds);
    }
    
    public void notifyOnProductUpdates(Set<Id> productIds) {
        if (!canAccessCustomer()) {
            return;
        }
    
        List<Customer__c> customers = [SELECT Name__c, Notify_By__c,
            SMS_Phone_Number__c, Twilio_From_Phone_Number__c 
            FROM Customer__c WHERE Notify_On_Low_Deals__c = TRUE];
            
        List<Products__x> products = getProductsLowOnStock(productIds);

        if (customers.size() > 0 && products.size() > 0) {
            String subject = 'Great product deals low on stock. Check them out';
            String message = 'The products below are low on stock:\n\n';
            String shortMessage = 'Products low on stock: ';
            
            message += toFitted('Product Name', 100);
            message += toFitted('Unit Price', 20);
            message += toFitted('Latest Stock', 20);
            message += '\n';
            message += toFitted('', 140, '-');
            message += '\n';            
            
            Boolean first = true;
            for (Products__x p: products) {
                message += toFitted(p.Name__c + ':', 100);
                Decimal price = p.UnitPrice__c;
                message += toFitted('$' + price.format(), 20);
                Integer stock = p.Stock__c.intValue();
                message += toFitted(stock.format(), 20);
                message += '\n';
                
                if (!first) {
                    shortMessage += '; ';
                    first = false;
                }
                shortMessage += p.Name__c + ' - $' + price.format() + ' - ' + stock.format();
            }
            
            notify(customers, subject, message, shortMessage);
        }
    }
    
    private List<Products__x> getProductsLowOnStock(Set<Id> productIds) {
        return [SELECT Id, ExternalId, Name__c, ProductId__c, Stock__c, UnitPrice__c  FROM Products__x
            WHERE Stock__c < :stockThreshold  AND Stock__c > 0 AND Id IN :productIds];
    }
    
    @future (callout=true)
    public static void notifyOnProductOrderUpdatesFuture(Set<Id> orderIds) {
        CustomerProductNotification notification = new CustomerProductNotification();
        notification.notifyOnProductOrderUpdates(orderIds);
    }
    
    public void notifyOnProductOrderUpdates(Set<Id> orderIds) {
        if (!canAccessCustomer()) {
            return;
        }
    
        List<ProductOrders__x> orders = getProductOrders(orderIds);
    
        for (ProductOrders__x order: orders) {
            List<Customer__c> customers = [SELECT Name__c, Notify_By__c,
                SMS_Phone_Number__c, Twilio_From_Phone_Number__c 
                FROM Customer__c 
                WHERE Name__c = :order.CustomerName__c AND Notify_Orders__c = TRUE];

            if (customers.size() > 0) {
                String message = 'Your order ' + order.ProductOrderId__c + ' for "' + 
                    order.ProductName__c + '" in the amount of $' + order.OrderPrice__c + ' is on its way.';
                notify(customers, 'Your Order ' + order.ProductOrderId__c + ' Is Ready', message, message);
            }
        }
    }
    
    private List<ProductOrders__x> getProductOrders(Set<Id> productOrderIds) {
        return [SELECT Id, CustomerName__c, ProductOrderId__c, ProductName__c, OrderPrice__c 
            FROM ProductOrders__x WHERE Id IN :productOrderIds];
    }
    
    public void notify(List<Customer__c> customers, String subject, String message, String shortMessage) {
        List<String> userNamesToEmail = new List<String>();
        
        for (Customer__c customer: customers) {
            if (customer.Notify_By__c == 'SMS') {
                sendSms(customer.Twilio_From_Phone_Number__c, customer.SMS_Phone_Number__c, shortMessage);
            } else if (customer.Notify_By__c == 'EMail') {
                userNamesToEmail.add(customer.Name__c);
            }
        }
        
        if (userNamesToEmail.size() > 0) {
            List<User> users = [SELECT Email FROM User WHERE Username IN :userNamesToEmail];
            List<String> toAddresses = new List<String>();
            for (User user: users) {
                toAddresses.add(user.Email);
            }
            sendEmails(toAddresses, subject, message);
        }
    }
    
    public void sendEmails(List<String> toAddresses, String subject, String body) {
        Messaging.SingleEmailMessage message = new Messaging.SingleEmailMessage();
        
        message.toAddresses = toAddresses;
        message.optOutPolicy = 'FILTER';
        message.subject = subject;
        message.plainTextBody = body;
        
        Messaging.SingleEmailMessage[] messages = new List<Messaging.SingleEmailMessage> {message};
        Messaging.sendEmail(messages);
    }
    
    public void sendSms(String fromPhone, String toPhone, String message) {
        String twilioUrl = 'callout:Twilio';
        
        String postBody = 'To=' + toPhone + '&From=' + fromPhone + '&Body=' + message;
        Http http = new Http();
        HttpRequest req = new HttpRequest();
        req.setEndpoint(twilioUrl);
        
        req.setMethod('POST');
        req.setBody(postBody);
        http.send(req);
    }
    
    public String toPaddedNumber(Integer value, Integer size) {
        String paddedValue = String.valueOf(value);
        while (paddedValue.length() < size) {
            paddedValue = '0' + paddedValue;
        }
        return paddedValue;
    }
    
    public String toFitted(String text, Integer size) {
        return toFitted(text, size, ' ');
    }
    
    public String toFitted(String text, Integer size, String fillerChar) {
        if (text.length() > size) {
            return text.substring(0, size - 4) + ' ...';        
        } else if (text.length() < size) {
            String fitted = text;
            while (fitted.length() < size) {
                fitted += fillerChar;
            }
            return fitted;
        } else {
            return text;
        }
    }
    
    // Return true if all the fields on Customer__c can be read, false otherwise
    // If Customer fields can'be accessed for the current user, then no notifications are sent
    private boolean canAccessCustomer() {
        return Schema.sObjectType.Customer__c.fields.Name__c.isAccessible();
    }
}