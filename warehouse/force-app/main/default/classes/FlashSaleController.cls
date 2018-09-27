public with sharing class FlashSaleController {
    private List<String> categoryNames;

    private final String FIVE_PERCENT = '5';
    private final String TEN_PERCENT = '10';
    private final String TWENTY_PERCENT = '20';
    private final String TWENTY_FIVE_PERCENT = '25';
    private final String FIFTY_PERCENT = '50';
        
    public String selectedCategory {get;set;}
    public String selectedDiscount {get;set;}
    public String selectedMinPrice {get;set;}
    public String selectedMaxPrice {get;set;}
    
    public FlashSaleController() {
        List<ProductCategories__x> categories = [SELECT Name__c FROM ProductCategories__x ORDER BY Name__c ASC];
        categoryNames = new List<String>();
        for (ProductCategories__x category: categories) {
            categoryNames.add(category.Name__c);
        }

        selectedDiscount = FIVE_PERCENT;
    }

    public SelectOption[] getCategoryList() {
        SelectOption[] options = new SelectOption[categoryNames.size()];
        for (Integer i = 0; i < categoryNames.size(); i++) {
            options[i] = new SelectOption(categoryNames.get(i), categoryNames.get(i));
        }
        return options;
    }
    
    public SelectOption[] getDiscountList() {
        return new SelectOption[] {
            new SelectOption(FIVE_PERCENT, FIVE_PERCENT + '%'),
            new SelectOption(TEN_PERCENT, TEN_PERCENT + '%'),
            new SelectOption(TWENTY_PERCENT, TWENTY_PERCENT + '%'),
            new SelectOption(TWENTY_FIVE_PERCENT, TWENTY_FIVE_PERCENT + '%'),
            new SelectOption(FIFTY_PERCENT, FIFTY_PERCENT + '%')
        };
    }
    
    public SelectOption[] getMinPriceList() {
        return getPriceList();
    }
    
    public SelectOption[] getMaxPriceList() {
        List<SelectOption> prices = getPriceList();
        prices.add(new SelectOption('1000000', '> $1000'));
        return prices;
    }
    
    private List<SelectOption> getPriceList() {
        List<SelectOption> opts = new List<SelectOption>();
        opts.add(new SelectOption('', ''));
        for (Integer n = 10; n <= 100; n += 20) {
            opts.add(new SelectOption(String.valueOf(n), '$' + n));
        }
        for (Integer n = 200; n <= 1000; n += 100) {
            opts.add(new SelectOption(String.valueOf(n), '$' + n));
        }
        return opts;
    }
    
    public PageReference startJob() {
        Integer salePercent = Integer.valueOf(this.selectedDiscount);
        Integer minPrice = 0;
        if (String.isNotEmpty(this.selectedMinPrice)) {
            minPrice = Integer.valueOf(this.selectedMinPrice);
        }
        Integer maxPrice = 1000000;
        if (String.isNotEmpty(this.selectedMaxPrice)) {
            maxPrice = Integer.valueOf(this.selectedMaxPrice);
        }
        FlashSaleJob job = new FlashSaleJob(this.selectedCategory, salePercent, minPrice, maxPrice);
        Database.executeBatch(job, 200);
        return null;
    }    
}
