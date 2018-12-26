// The Inflation Javascript Library
//
// Copyright (c) 2016-2018 WELLEVO Teemu Lätti
//
// teemu.latti@wellevo.com
//

var Inflation = {
    
    /** List of objects that can be inflated.
     *  Object structure:
     *      name  : string : object name
     *      attrs : [{ name, value }, ...] : attributes for main tag
     *      body  : string : html text
     *      (NOTE that styles and scripts are evaluated when loaded and not stored)
     */
    objects: [],
    
    /** List of remote files included */
    includes: [],

    /** List of remote files pending async loading */
    waiting: [],

    /** List of internal include functions waiting for chained include */
    includeFuncs: [],

    /** List of internal ready functions registered by includes */
    readyIncludeFuncs: [],

    /** List of global ready functions registered by user that will be called once
        in registration order when all remote files have been loaded and the page inflated
    */
    readyFuncs: [],

    /** Marks that inflation logging is enabled */
    loggingEnabled: false,

    /** Enables inflation logging */
    logging: function (enableLogging) {
        "use strict";
        Inflation.loggingEnabled = enableLogging;
    },

    /** Parses include file contents and creates objects
     *   Contents format:
     *      <html>
     *          <style>styles</styles>
     *          <body name="object1" attributes1>contents1</body>
     *          <body name="object2" attributes2>contents2</body>
     *          <script>scripts</body>
     *      </html>
     */
    parseInclude: function (str) {
        "use strict";
        
        // NOTE: yes, I did try to do this with XML parser,
        // but it turned out it makes little sense because we will anyway convert
        // everything back to string when inflating
        
        // Style
        var style = "";
        var beg = str.indexOf("\<\style\>");
        var end = 0;
        if (beg >= 0) {
            beg += 7;
            end = str.indexOf("\<\/style\>");
            if (end > beg) {
                style = str.substr(beg, end - beg);
            }
        } else {
            // Ok not to have style tag
        }
        
        // Embed style to document
        // NOTE: correct order is before previously included styles, so overrides
        if (style.length > 0) {
            var styleElement = document.createElement("style");
            styleElement.innerHTML = style;
            document.head.insertBefore(styleElement, document.head.childNodes[0]);
        }

        // Bodies
        beg = end;
        for (;;) {
            // Find next body
            beg = str.indexOf("\<body name=\"", beg);
            if (beg < 0) {
                break;
            }
            beg += 12;
            end = str.indexOf("\"", beg);

            // New object with name
            var obe = new Object();
            Inflation.objects.push(obe);
            obe.name = str.substr(beg, end - beg);
            Inflation.log("define: " + obe.name);

            // Attributes
            beg = end + 1;
            end = str.indexOf("\>", beg);
            var attrs = str.substr(beg, end - beg);
            obe.attrs = new Array();
            for (;;) {
                while (attrs.length > 0 && attrs.substr(0, 1) == " ") {
                    attrs = attrs.substr(1);
                }
                var i = attrs.indexOf("=");
                if (i < 0) {
                    break;
                }
                var attr = new Object();
                attr.name = attrs.substr(0, i);
                if (attr.name.length == 0) {
                    break;
                }
                attrs = attrs.substr(++i);
                if (attrs.substr(0, 1) != "\"") {
                    break;
                }
                attrs = attrs.substr(1);
                i = attrs.indexOf("\"");
                if (i < 0) {
                    break;
                }
                attr.value = attrs.substr(0, i);
                obe.attrs.push(attr);
                attrs = attrs.substr(++i);
            }

            // Body
            beg = end + 1;
            end = str.indexOf("\<\/body\>", beg);
            obe.body = str.substr(beg, end - beg);

            //Inflation.trace(beg + " [" + obe.name + "]=" + obe.body);

            // Next
            beg = end;
        }

        // Script
        beg = str.indexOf("\<\script\>");
        end = str.indexOf("\<\/script\>");
        beg += 8;
        var script = str.substr(beg, end - beg);

        // Evaluate the script
        //Inflation.trace("eval: " + script);
        if (window.execScript) {
            window.execScript(script);
        } else {
            window.eval.call(window, script);
        }
    },

    /** Includes remote file which contains style+body+script parts OR file which contains only style(.css)/script(.js)
    *   readyFunc is optional. Includes file only once.
    */
    include: function( url, /*opt*/ readyFunc ) {
        "use strict";
        var getUrlExt = function(s) {
            var i = s.lastIndexOf('?');
            if (i >= 0) {
                s = s.substr(0,i);
            }
            i = s.lastIndexOf('.');
            return (i >= 0) ? s.substr(i) : "";
        };
        var ext = getUrlExt(url);
        if (ext == ".js") {
            if (Inflation.waiting.length > 0) {
                // Scripts must be loaded in order, because they may depend on each other
                Inflation.includeFuncs.push(function() {
                    Inflation.includeSub(url, readyFunc, 3);
                });
            } else {
                Inflation.includeSub(url, readyFunc, 3);
            }
        } else if (ext == ".css") {
            Inflation.includeSub(url, readyFunc, 2);
        } else {
            Inflation.includeSub(url, readyFunc, 0);
        }
    },

    includeSub: function(url, readyFunc, type) {
        "use strict";

        // Include file only once
        if (Inflation.includes.indexOf(url) >= 0 ) {
            Inflation.log("include(\"" + url + "\") already included");
            return;
        }
        Inflation.log("include(\"" + url + "\")");
        Inflation.includes.push(url);

        // Now waiting for this file to be loaded
        Inflation.waiting.push(url);
        
        // Request for download async
        Inflation.request(url, function (resp) {
            //Inflation.trace(resp);
            if (resp != null) {
                if (type == 0) {
                    // Inflation component file
                    Inflation.parseInclude(resp);
                    
                } else if (type == 2) {
                    // CSS file
                    // NOTE: correct order is before previously included styles, so overrides
                    var styleElement = document.createElement("style");
                    styleElement.innerHTML = resp;
                    document.head.insertBefore(styleElement, document.head.childNodes[0]);
                    
                } else if (type == 3) {
                    // JS file
                    if (window.execScript) {
                        window.execScript(resp);
                    } else {
                        window.eval.call(window, resp);
                    }
                }

                Inflation.complete(url);
            } else {
                Inflation.error("include() http request failed: " + url);
            }
        });
        
        // Register ready function
        if ( readyFunc ) {
            Inflation.readyIncludeFuncs.push(readyFunc);
        }
    },
    
    /** Creates new HTML div element. className is optional */
    div: function (/*opt*/ className) {
        var element = document.createElement("div");
        if (className) {
            element.setAttribute("class", className);
        }
        return element;
    },

    /** Inflates contents from "objectName" and returns it as HTML div element.
     */
    inflate: function( objectName ) {
        "use strict";
        Inflation.log("inflate: " + objectName);
        var element = null;
        var obe = Inflation.getObject( objectName );
        if (obe != null) {
            // Element div that contains the returned inflated body
            element = document.createElement("div");

            // Content body
            element.innerHTML = obe.body;
            
            // Attributes
            for (var i = 0; i < obe.attrs.length; i++) {
                element.setAttribute(obe.attrs[i].name, obe.attrs[i].value);
            }

            // Inflate the inflated body in case there are "inflate" tags
            // in the body
            Inflation.inflateElement( element );
        } else {
            Inflation.error("inflate object not found: " + objectName);
        }
        return element;
    },
    
    /** Gets object specified by "objectName" */
    getObject: function( objectName ) {
        for (var i in Inflation.objects) {
            var obe = Inflation.objects[i];
            if (obe.name == objectName) {
                return obe;
            }
        }
        return null;
    },

    /** Gets element by ID within specified element (not whole document) */
    getElementById: function( element, id ) {
        "use strict";
        var child = element.firstChild;
        while (child) {
            if (child.id === id) {
                return child;
            }
            var grandchild = Inflation.getElementById( child, id );
            if (grandchild) {
                return grandchild;
            }
            child = child.nextSibling;
        }
        return null;
    },

    /** Creates async HTTP request to fetch file from url */
    request: function (url, func, user, password) {
        // Create HTTP request object
        "use strict";
        var httpreq = null;
        if (window.XMLHttpRequest) {
            // code for IE7, Firefox, Opera, etc.
            httpreq = new XMLHttpRequest();
        } else if (window.ActiveXObject) {
            // code for IE6, IE5
            httpreq = new ActiveXObject("Microsoft.XMLHTTP");
        }

        // Call to get the page
        if (httpreq != null) {
            // Open http request
            httpreq.open("GET", url, true, user, password);

            // Callback method
            httpreq.onreadystatechange = function () {
                if (httpreq.readyState == 4) {
                    // 4 = "loaded"
                    var response;
                    if (httpreq.status >= 200 && httpreq.status <= 299) {
                        // 200 = "OK"
                        response = httpreq.responseText;
                    } else if (httpreq.status == 0) {
                        // Usually this hits when request was cancelled due user navigating to other page
                        // (depatable if this happens otherwise also and what we should do here)
                        response = "";
                    } else {
                        //console.log("status="+httpreq.status);
                        response = null;
                    }

                    // Call specified callback function
                    if (func) {
                        func(response);
                    }

                    // Last set http request to null, which releases closure
                    httpreq = null;
                }
            };

            // Make http request
            httpreq.setRequestHeader("If-Modified-Since", new Date(0)); // no cache
            httpreq.send(null);
            return httpreq;
        } else {
            alert("Your browser does not support XMLHTTP.");
            return null;
        }
    },

    /** Registers function for global ready event when all includes have been loaded and the page has been inflated */
    ready: function (func) {
        "use strict";
        Inflation.readyFuncs.push(func);
        this.checkReady(); // immediately check in case there is no includes
    },

    arrayIndexOf: function (arr, obe) {
        "use strict";
        for (var i in arr) {
            if (arr[i] == obe) {
                return i;
            }
        }
        return -1;
    },

    /** Completes async loading of remote file "url" */
    complete: function (url) {
        "use strict";
        Inflation.waiting.splice(Inflation.arrayIndexOf(Inflation.waiting, url), 1);
        this.checkReady();
    },

    /** Checks if ready functions can be called */
    checkReady: function () {
        "use strict";
        
        // Do nothing if still pending
        if (Inflation.waiting.length > 0) {
            return;
        }
        
        // Handle chained includes first
        while (Inflation.includeFuncs.length > 0) {
            Inflation.includeFuncs[0]();
            Inflation.includeFuncs.splice(0, 1);
            if (Inflation.waiting.length > 0) {
                // Pretty sure this happens every time, but let's do this anyway same way
                return;
            }
        }

        // Inflate the document with now-available components, because the callback may expect them to be inflated
        Inflation.inflateDocument();

        // Call include ready functions
        Inflation.log("ready: includes");
        while (Inflation.readyIncludeFuncs.length > 0) {
            try {
                Inflation.readyIncludeFuncs[0]();
            } catch (e) {
                //alert("exception: " + e);
                //alert("exception in callback=" + Inflation.readyIncludeFuncs[0]);
                Inflation.error("checkReady() exception in ready callback: " + e);
                throw(e);
            }
            Inflation.readyIncludeFuncs.splice(0, 1);

            // If the callback included new files, we must stop and wait ready again
            if (Inflation.waiting.length > 0) {
                return;
            }
        }

        // Call global ready functions
        Inflation.log("ready: global");
        while (Inflation.readyFuncs.length > 0) {
            try {
                Inflation.readyFuncs[0]();
            } catch (e) {
                //alert("exception: " + e);
                //alert("exception in callback=" + Inflation.readyFuncs[0]);
                Inflation.error("checkReady() exception in ready callback: " + e);
                throw(e);
            }
            Inflation.readyFuncs.splice(0, 1);

            // If the callback included new files, we must stop and wait ready again
            if (Inflation.waiting.length > 0) {
                return;
            }
        }

        // If we passed here, then all is ready
        Inflation.log("ready: all");
    },
    
    /** Inflates the whole document searching for inflation tags */
    inflateDocument: function() {
        Inflation.log("inflate: document");
        Inflation.inflateElement( document.body );
    },

    /** Inflates element and subelements searching for inflation tags */
    inflateElement: function(element) {
        
        // Ignore other than HTML element nodes (text nodes etc)
        if (element.getAttribute === undefined) {
            return;
        }
        
        // Check this node
        var objectName = element.getAttribute("inflate");
        if (objectName) {
            // Inflate contents children and attributes
            // (ignoring the container div that is created by inflator)
            // NOTE must use intermediate array because adding child to node
            // immediately removes it from the previous parent
            var inflated = Inflation.inflate( objectName );
            var children = new Array();
            var child = inflated.firstChild;
            while (child) {
                children.push(child);
                child = child.nextSibling;
            }
            for (var i in children) {
                element.appendChild( children[i] );
            }
            for (var i in inflated.attributes) {
                var name = inflated.attributes[i].name;
                var value = inflated.attributes[i].value;
                // element.attributes also includes methods, but this check protects against that
                if (value) {
                    if (name == "class") {
                        // Do not replace classes but only add to them
                        element.className += ((element.className.length > 0) ? " " : "") + value;
                    } else {
                        // Other attribute we change
                        element.setAttribute(name, value);
                    }
                }
            }

            // Remove inflation attribute to make sure not inflated twice
            element.removeAttribute("inflate");
        }

        // Inflate all children
        var node = element.firstChild;
        while (node) {
            Inflation.inflateElement( node );
            node = node.nextSibling;
        }
    },
        
    /** Prints log message to console if logging is enabled */
    log: function(msg) {
        "use strict";
        if (Inflation.loggingEnabled) {
            Inflation.trace(msg);
        }
    },

    /** Prints trace message to console */
    trace: function (msg) {
        "use strict";
        if (window.console) {
            window.console.log(msg);
        }
    },
    
    error: function (msg) {
        if (window.console) {
            window.console.error("INFLATION: " + msg);
        }
    },

    /** Initializes object as Inflation object
            var that = Inflation.super(this)
            var that = Inflation.super(this, Parent, elementOrName)
            var that = Inflation.super(this, elementOrName)
    */
    super: function( this_, a2, a3 ) {
        if (typeof(a2) === 'function') {
            // Inflation.super(this, Parent, elem) => call parent class constructor
            a2.call(this_, a3);
            return this_;
        }

        // Inflation.super(this, elem)
        var elementOrName = a2;
        
        if (typeof(elementOrName) === 'string' || elementOrName instanceof String) {
            // Inflate to element
            this_.elem = Inflation.inflate(elementOrName);
        } else {
            // Assuming is element
            this_.elem = elementOrName;
        }

        // Methods
        this_.getElementById = function(id) {
            return Inflation.getElementById( this_.elem, id );
        };
        
        return this_;
    },
    
    hasClass: function(element, className) {
        return (className.length > 0 && (" " + element.className + " ").indexOf(" " + className + " ") >= 0);
    },
    
    addClass: function(element, className) {
        if (className.length > 0 && !Inflation.hasClass(element, className)) {
            element.className += ((element.className.length > 0) ? " " : "") + className;
        }
    },
    
    removeClass: function(element, className) {
        if (className.length > 0 && Inflation.hasClass(element, className)) {
            element.className = (" " + element.className + " ").replace(" " + className + " ", " ").trim();
        }
    },

    changeClass: function(element, className, set) {
        if (set) {
            Inflation.addClass(element, className);
        } else {
            Inflation.removeClass(element, className);
        }
    },
}
