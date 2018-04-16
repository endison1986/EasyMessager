# EasyMessager

Support for cross-domain message component for Javascript

## User Guide

Include EasyMessage.js/EasyMessage.min.js and Instantiate Client in top or same domain html page.

```javascript
<script src="EasyMessage.js" type="text/javascript"></script>
<script>
var client = new Client('UniqueID');
client.listen(function(content, event){ // registry listener
	console.log(content); // This is a test message.
});
</script>
```

Include EasyMessage.js/EasyMessage.min.js and Instantiate Client in other domain html page.
```javascript
<script src="EasyMessage.js" type="text/javascript"></script>
<script>
var client = new Client('OtherUniqueID');
setTimeout(function(){ // send message
	client.send('UniqueID', 'This is a test message.');
}, 1000);
</script>
```
