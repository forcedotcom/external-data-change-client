trigger LowOnStock on Products__ChangeEvent (after insert) {
    // Filter out deleted product events. Get product id
    Set<Id> productIds = new Set<Id>();
    for (Products__ChangeEvent event: Trigger.new) {
        if (event.ChangeEventHeader.getChangeType() != 'DELETE') {
            String productId = event.ChangeEventHeader.getRecordIds()[0];
            productIds.add(productId);
        }
    }

    if (productIds.size() > 0) {
        CustomerProductNotification.notifyOnProductUpdatesFuture(productIds);
        //CustomerProductNotification.orderOnLowOnStockProductUpdatesFuture(productIds);
    }
}