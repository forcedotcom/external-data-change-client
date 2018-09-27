public with sharing class FlashSaleJob implements Database.Batchable<sObject> {
    private final String  category;
    private final Decimal priceAdjustment;
    private final Integer minPrice;
    private final Integer maxPrice;
    
    private Integer updatedRecordCount = 0;
    
    public FlashSaleJob(String category, Integer saleInPercent, 
                        Integer minPrice, Integer maxPrice) {
        this.category = category;
        this.priceAdjustment = 1.0 - (saleInPercent / 100.0);
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
    }
    
    public Database.QueryLocator start(Database.BatchableContext ctx) {
        if (!canAccessProducts()) {
            System.debug('Can\'t access Products__x');
        }
        String soql = 'SELECT ProductId__c, UnitPrice__c FROM Products__x ' +
            'WHERE Category__c = \'' + this.category + '\' AND ' +
            'UnitPrice__c >= ' + this.minPrice + ' AND ' +
            'UnitPrice__c <= ' + this.maxPrice + 
            ' ORDER BY ProductId__c';
        return Database.getQueryLocator(soql);
    }
    
    public void execute(Database.BatchableContext ctx, List<sObject> scope) {
        for (sObject p : scope) {
            Decimal originalPrice = (Decimal)p.get('UnitPrice__c');
            Decimal salePrice = originalPrice * this.priceAdjustment;
            p.put('UnitPrice__c', salePrice);
        }
        Database.updateAsync(scope); 
        updatedRecordCount += scope.size();           
    }
    
    public void finish(Database.BatchableContext ctx) {
        // Here we could send a notification, or write a log message.
        System.debug('Flash sale has been kicked off. Number of products with reduced price: ' 
            + updatedRecordCount);
    }

    private boolean canAccessProducts() {
        return Schema.SObjectType.Products__x.fields.ProductId__c.isAccessible();
    }
}