/**
 * @description EasyMessagerJS
 * @author: biding
 * @version: 1.0
 * @license release under MIT license
 */
(function () {
	'strict'
	
    var PREFIX = "[MESSAGE_PREFIX]", 
		STATE_NONE = 'STATE_NONE', 
		STATE_CREATING = 'STATE_CREATING', 
		STATE_CREATED = 'STATE_CREATED', 
		TOP_WINDOW = 'TOP_WINDOW', 
		COMMAND = {
			REQUEST_REGISTRY: 'REQREG',
			RESPONSE_REGISTRY: 'RESREG',
			UNICAST_MESSAGE: 'UNICASTMSG',
			MULTICAST_MESSAGE: 'MULTICASTMSG',
			SEND_MESSAGE: 'SENDMSG'
		};

    function Event(event) {
        this.event = event;
        this.valid = false;
        if (typeof event == 'object' && event.data) {
            var data = event.data;
            if (data.startsWith(PREFIX)) {
                data = JSON.parse(data.slice(PREFIX.length));
                this.type = data.type;
                this.target = data.target;
                this.source = data.source;
                this.content = data.content;
                this.valid = true;
            }
        }
    }

    Event.prototype.isValid = function () {
        return this.valid;
    };

    Event.prototype.getOriginalEvent = function () {
        return this.event;
    };

    function Target(win, name) {
        var errMsg = '';
        if (arguments.length < 2) {
            throw new Error('IllegalArgumentException: arguments must constain window and name');
        } else if (typeof win != 'object') {
            throw new Error('IllegalArgumentException: first argument must be window object');
        } else if (typeof name != 'string') {
            throw new Error('IllegalArgumentException: second argument must be the client name');
        }
        this.win = win;
        this.name = name;
    }

    /**
     * type: multicast_msg, unicast_msg, send_msg, req_reg, res_reg
     * name: client's name
     * content: message body
     */
    Target.prototype.send = function (data) {
        this.win.postMessage(PREFIX + JSON.stringify(data), '*');
    };

    Target.prototype.isClosed = function () {
        return this.win.closed;
    };

    function Messager(win) {
        this.win = win || window;
        this.listens = {};
        this.initListener();
    }

    Messager.prototype.initListener = function () {
        var me = this,
            callback = function (e) {
                var event = new Event(e);
                if (event.isValid()) {
                    var type = event.type;
                    var listen = me.listens[type];
                    if (listen) {
                        for (var i = 0; i < listen.length; i++) {
                            listen[i](event.content, event);
                        }
                    }
                }
            };

        if ('addEventListener' in document) {
            me.win.addEventListener('message', callback, false);
        } else if ('attachEvent' in document) {
            me.win.attachEvent('onmessage', callback);
        }
    };

    /**
     * @param callback {function} callback
     * @param type {string} type:send_msg, multicast_msg, unicast_msg, req_reg, res_reg
     */
    Messager.prototype.listen = function (callback, type) {
        var type = type || COMMAND.SEND_MESSAGE,
            listens = this.listens;

        listens[type] ? listens[type].push(callback) : listens[type] = [callback];
    };

    Messager.prototype.clear = function () {
        this.listens = {};
    };

    function Server() {
        var me = this;
        me.parent = Messager;
        me.parent(window.top);
        delete me.parent;

        me.targets = {};
        // registry request handler
        me.listen(function (content, event) {
            var source = event.getOriginalEvent().source;
            try {
                var target = new Target(source, event.source);
                me.registryTarget(target);
                target.send({
                    type: COMMAND.RESPONSE_REGISTRY
                });
            } catch (e) {
                throw e;
            }
        }, COMMAND.REQUEST_REGISTRY);
        // post message handler
        me.listen(function (content, event) {
            me.send(event.content, event.target, event.source);
        }, COMMAND.UNICAST_MESSAGE);

        me.listen(function (content, event) {
            me.multicast(event.content, event.source);
        }, COMMAND.MULTICAST_MESSAGE);
    }

    Server.prototype = new Messager();

    Server.prototype.multicast = function (data, source) {
        var targets = this.targets;
        for (var target in targets) {
            var targetArray = targets[target];
            if (targetArray) {
                for (var i = 0, len = targetArray.length; i < len; i++) {
                    var t = targetArray[i];
                    if(t.isClosed()){
                        console && console.log && console.log("Target[" + t.name + "] is left!");
                    }else {
                        t.send({
                            type: COMMAND.SEND_MESSAGE,
                            target: target,
                            source: source,
                            content: data
                        });
                    }
                }
            }
        }
    };

    Server.prototype.send = function (data, target, source) {
        var targets = this.targets;
        if (targets.hasOwnProperty(target)) {
            var targetArray = targets[target];
            if (targetArray) {
                for (var i = 0, len = targetArray.length; i < len; i++) {
                    var t = targetArray[i];
                    if(t.isClosed()){
                        console && console.log && console.log("Target[" + t.name + "] is left!");
                    }else{
                        t.send({
                            type: COMMAND.SEND_MESSAGE,
                            target: target,
                            source: source,
                            content: data
                        });
                    }
                }
            }
        }
    };

    Server.prototype.registryTarget = function (target) {
        var targets = this.targets,
            targetArray = targets[target.name];
        if (!targetArray) {
            targetArray = targets[target.name] = [];
        }
        targetArray.push(target);
    };

    function Client(name) {
        var me = this;
        me.parent = Messager;
        me.parent();
        delete me.parent;
		
		var topWindow = window.top;

        if (!topWindow.serverState)
        {
			topWindow.serverState = STATE_CREATED;
            new Server();
        }

        me.serverTarget = new Target(topWindow, TOP_WINDOW);
        me.name = name;

        // registry response handler
        me.listen(function () {
            me.regSuccess = true;
        }, COMMAND.RESPONSE_REGISTRY);
		
		// send registry request to server
		me.serverTarget.send({
			type: COMMAND.REQUEST_REGISTRY,
			source: name
		});	
    }

    Client.prototype = new Messager();

    Client.prototype.send = function (name, data, type) {
        var me = this, type = type || COMMAND.UNICAST_MESSAGE;
        if (me.regSuccess) {
            me.serverTarget.send({
                type: type,
                target: name,
                source: me.name,
                content: data
            });
        } else {
            throw new Error('Registry Failure...');
        }
    };

    Client.prototype.multicast = function (data) {
        this.send('', data, COMMAND.MULTICAST_MESSAGE);
    };

    window.MessageClient = Client;
})();