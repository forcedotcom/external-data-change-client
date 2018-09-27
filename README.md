# External Data Change Client
Codey Warehouse is a sample client that showcases business process automation with data changes from an external system.
The client is an application to a sample OData provider that models aspects of a warehouse such as a product
inventory and ordering system.

The client showcases these external data change concepts available with Salesforce connect OData version 4.0:
* Visualforce page that subscribes to external data changes by means of Salesforce Streaming API
* Apex trigger that is called on external data changes

## Warehouse Sample Application
The Codey Warehouse sample application illustrates implementation aspects of a warehouse:
* A customer logs into the warehouse portal implemented by a Salesforce Visualforce page.
  On this page, the customer can browse special product deals of the last 24 hours and can place orders.
  New deals will show as they are made available in Codey's warehouse.
  
* A customer gets notified via SMS or E-Mail about special deals for products with low inventory.
  The customer might not want to miss out on a great deal. The customer gets notified when the order has been shipped.
  
* A customer can set up an automated order process with Apex triggers

* An example with Process Builder showcases how to react to shipment events and declaratively interact with external
  objects. 

* The warehouse administrator can automate a flash sale with Batch Apex
 
## Prerequistes
* You need a Salesforce account with a license to create a Salesforce OData 4.0 connector:
 [OData 4.0 Adapter for Salesforce Connect](https://help.salesforce.com/articleView?id=odata_adapter_about.htm&type=5)

* Triggers on external objects is in Beta for the Salesforce Winter '19 release. 
  You can sign up for the Beta Program by submitting a support case.
  
* External objects in Process Builder is currently not available and will be available in the Salesforce Spring '19 release.
  Exclude the `flows` and `flowDefinitions` folders from `force-app/main/default` before deploying on an earlier release.
 
* An OData 4.0 provider with remote data change tracking capability:
 [OASIS OData Version 4.0 Protocol: Requesting Changes](http://docs.oasis-open.org/odata/odata/v4.0/errata02/os/complete/part1-protocol/odata-v4.0-errata02-os-part1-protocol-complete.html#_Toc406398316) 
 
* Optional: [Twilio Account](https://www.twilio.com) to demonstrate the sending of SMS messages
 
## Setup
1. Get the Salesforce development environment [Salesforce DX CLI](https://developer.salesforce.com/tools/sfdxcli)
1. Clone this Git repository. `warehouse` holds the Warehouse sample application in Salesforce DX source format.
   This sample application has all components needed, including the external object
   and external data source to talk to the sample Warehouse OData provider.
   Some of the parameters are tied to an account, so best to edit them now before deploying:
   1. Edit the `endpoint` in the external data source to set it to your OData provider: `warehouse/force-app/main/default/dataSources/Warehouse.dataSource-meta.xml`.
   2. To send SMS, update the named credential `Twilio` to your Twilio account or other SMS provider `endpoint` to `https://api.twilio.com/Accounts<Account Open Date>/<User/Account Name>/Messages.json`
   and the `username` to the Twilio's account username in `warehouse/force-app/main/default/namedCredentials/Twilio.namedCredential`
   3. To send email from your process, change all references in `ShipmentTrackingNotification-1.flow` from `:email` to your email address. 
1. Deploy the application to your org. Below are instructions for the Salesforce DX CLI
   1. Log into your org - a browser with the Salesforce login opens: `sfdx force:auth:web:login`
   1. Go to your project: `cd warehouse`
   1. Set your default username for the org you work with: `sfdx force:config:set defaultusername=<your username>`
   1. Convert the DX project to Salesforce deployable metadata: `sfdx force:source:convert`
   1. Deploy the metadata directory to your org: `sfdx force:mdapi:deploy -d metadataPackage_<number sequence>`
1. In your org's setup, type `Permission Sets` in the Quick Find box and open the Permission Set `Codey Outdoor Fitters`.
   Click on `Manage Assigments` and assign the application's permission set to your user.
1. To send email or SMS messages to sample customers, do the following:
   1. Create a new `Customer__c` record. Choose whether to receive EMail or SMS messages
   1. The customer name needs to match an existing Salesforce User. The Salesforce's User Email is used to send Email messages.
   1. Optional: For SMS, navigate to `Setup > Administer > Security Controls > Named Credentials` and look for `Twilio`.
   Update the user credentials for your SMS account. By default, it is set to no authentication.
1. Enable data change capture for the external objects `Products` and `Product Orders` on the external object setup page
   by checking `Track Data Changes`.

## Dojo Dependencies
* The Dojo base libraries are included by direct reference in `Warehouse.page`
```xml
<apex:includeScript value="//ajax.googleapis.com/ajax/libs/dojo/1.12.1/dojo/dojo.js"/>
```
* The Cometd dojox library is version 3.1.3 available under `warehouse/force-app/main/default/staticresources/CometdDojo313Zip`.
They can be updated from [Github cometd/cometd-dojo](https://github.com/cometd/cometd-dojo)

There is a small bug where the common Cometd parts are under `cometd-dojo-3.1.3/org`. The package file 
`cometd.js` needs to be moved to the directory `cometd`: So from `org/cometd.js` to `org/cometd/cometd.js`.

* The Warehouse client Dojo classes are under `staticresources`

The static Dojo library zip files are referenced in the Visualforce page as follows before loading dojo.js:
```xml
    <script type="text/javascript">
        dojoConfig= {
            async: true,
            paths: {
                "dojox/cometd": "{!URLFOR($Resource.CometdDojo313Zip, '/cometd-dojo-3.1.3/cometd')}",
                "cometd": "{!URLFOR($Resource.CometdDojo313Zip, '/cometd-dojo-3.1.3/org/cometd')}",
                "warehouse": "{!URLFOR($Resource.ExternalDataChangeClientZip, '/warehouse')}",
                "data": "{!URLFOR($Resource.ExternalDataChangeClientZip, '/data')}",
                "channel": "{!URLFOR($Resource.ExternalDataChangeClientZip, '/channel')}"
            }
        };
    </script>
```

## Trying It Out
Once the application has been deployed, log into your Salesforce org. You should see these artifacts:
* _Codey Outdoor Fitters - Your Deals_ The application with the tabs Customers, Product Deals
* _Codey Outdoor Fitters Warehouse_ The application that holds the tabs Customers, Product Orders, Products and Flash Sale 
  This application illustrates the state of the warehouse in Codey's Salesforce org for example.
* _Daily Deals_: The tab that shows the deals of the last 24 hours and new deals as they're available.
* _Products_: The warehouse product inventory. This is the external object _Products__x_
* _Product Orders_: Customer orders represented by the external object _ProductOrders__x_
* _Customers_: The customers buying products from the warehouse. This is the custom object _Customer__c_.
  It holds customer details, for example whether they are interested in deals and whether they would like to
  be notified for deals and orders by SMS or E-Mail.
* _FlashSale_: Visual force page to promote a set of products for a flash sale.
* _FlashSaleJob_: Flash sale batch Apex job working on a larger set of external objects asynchronously 
* _LowOnStock_: Apex trigger on _Products__x_ that sends an SMS when products are low on stock for deals that 
  customers are interested in.
* _OrderShipped_: Apex trigger on _ProductOrders__x_ that sends an SMS when an order is shipped.
* _CustomerNotificationAction_: An invocable action to send customer notifications from a process.
* _ShipmentTracking_: Platform event sent for updated order shipping status.
* _ShipmentTrackingNotification_: Process that reacts to published shipment tracking events. 

To get external changes from the warehouse, enable external data change tracking for the external objects
`Products__x` and `ProductOrders__x`. Edit the Product inventory to see notifications on your daily deals page.
 
To enable or disable external change tracking, check the flag `Track Data Changes` on the external
object setup page. You can also see the current status under `Change-Tracking Status`.

To set the endpoint for your OData 4.0 provider, you can edit `warehouse/force-app/main/default/dataSources/Warehouse.dataSource-meta.xml`
or update the URL for the external data source Warehouse on its setup page:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ExternalDataSource xmlns="http://soap.sforce.com/2006/04/metadata">
    <customConfiguration>{&quot;inlineCountEnabled&quot;:&quot;true&quot;,&quot;csrfTokenName&quot;:&quot;&quot;,&quot;requestCompression&quot;:&quot;false&quot;,&quot;pagination&quot;:&quot;CLIENT&quot;,&quot;Change-Tracking Interval&quot;:&quot;300&quot;,&quot;noIdMapping&quot;:&quot;false&quot;,&quot;format&quot;:&quot;JSON&quot;,&quot;compatibility&quot;:&quot;DEFAULT&quot;,&quot;csrfTokenEnabled&quot;:&quot;false&quot;,&quot;timeout&quot;:&quot;120&quot;,&quot;searchEnabled&quot;:&quot;true&quot;}</customConfiguration>
    <endpoint> --- Set your endpoint here ---</endpoint>
    <isWritable>true</isWritable>
    <label>Warehouse</label>
    <principalType>Anonymous</principalType>
    <protocol>NoAuthentication</protocol>
    <type>OData4</type>
</ExternalDataSource>
```
