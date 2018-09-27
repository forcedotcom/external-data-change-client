trigger ProductOrdered on ProductOrders__ChangeEvent (after insert) {
    // Get current product orders for product updates
    Set<Id> productOrderIds = new Set<Id>();
    for (ProductOrders__ChangeEvent event: Trigger.new) {
        if (event.ChangeEventHeader.getChangeType() != 'DELETE') {
            String productOrderId = event.ChangeEventHeader.getRecordIds()[0];
            productOrderIds.add(productOrderId);
        }
    }

    if (productOrderIds.size() > 0) {
        CustomerProductNotification.notifyOnProductOrderUpdatesFuture(productOrderIds);
    }
}