public with sharing class CustomerNotificationAction {
	@InvocableMethod(label='Notification to a customer' description='Notify a customer with customer name by SMS or email based on their preference')
	public static void notifyCustomers(List<CustomerNotification> customerNotifications) {
		System.debug('Invocable action called: ' + customerNotifications.size());
		setCustomers(customerNotifications);

		for (CustomerNotification customerNotification: customerNotifications) {
			notifyCustomer(customerNotification);
		}
	}

	private static void notifyCustomer(CustomerNotification customerNotification) {
		if (customerNotification.customer != null) {
			List<Customer__c> customers = new List<Customer__c>();
			customers.add(customerNotification.customer);

			CustomerProductNotification notification = new CustomerProductNotification();
			notification.notify(customers, customerNotification.subject,
					unescapeFormulaBrs(customerNotification.message),
					unescapeFormulaBrs(customerNotification.shortMessage));
		}
	}

	private static void setCustomers(List<CustomerNotification> customerNotifications) {
		List<String> customerNames = new List<String>();
		Map<String, CustomerNotification> nameToCustomerNotifications = new Map<String, CustomerNotification>();
		for (CustomerNotification customerNotification: customerNotifications) {
			customerNames.add(customerNotification.customerName);
			nameToCustomerNotifications.put(customerNotification.customerName, customerNotification);
		}

		List<Customer__c> customers = [SELECT Name__c, Notify_By__c, SMS_Phone_Number__c, Twilio_From_Phone_Number__c
				FROM Customer__c
				WHERE Name__c IN :customerNames];

		for (Customer__c customer: customers) {
			CustomerNotification customerNotification = nameToCustomerNotifications.get(customer.Name__c);
			if (customerNotification != null) {
				customerNotification.customer = customer;
			}
		}
	}

	// Swap formula BR() _BR_ENCODED_ with \n
	// See knowlege article: https://success.salesforce.com/issues_view?id=a1p300000008YkZAAU
	private static String unescapeFormulaBrs(String formulaText) {
		return formulaText == null ? null : formulaText.replace('_BR_ENCODED_', '\n');
	}

	public class CustomerNotification {
		@InvocableVariable(required=true)
		public String customerName;

		public Customer__c customer;

		@InvocableVariable(required=true)
		public String subject;

		@InvocableVariable
		public String message;

		@InvocableVariable
		public String shortMessage;
	}
}
