/*
Please do not edit this file directly (unless you intend to fork).
  It's been open-sourced here:
    http://github.com/dgouldin/django-hashsignal

Requires
  * jQuery hashchange event - v1.2 - 2/11/2010
  * http://benalman.com/projects/jquery-hashchange-plugin/
*/

(function(window, $, undefined){
    function strip(s, chars) {
      // strips chars from the beginning and end of s,
      // returns the modified string
      var str = String(s),
          i;

      chars = chars || ' ';
      for (i = 0; i < str.length; i++) {
        if (chars.indexOf(str.charAt(i)) === -1) {
          str = str.substring(i);
          break;
        }
      }
      for (i = str.length - 1; i >= 0; i--) {
        if (chars.indexOf(str.charAt(i)) === -1) {
          str = str.substring(0, i + 1);
          break;
        }
      }
      return chars.indexOf(str.charAt(0)) === -1 ? str : '';
    }
    function unquote(s) {
      var str = String(s);

      $.each("'\"", function(i, quote) {
        if (str.charAt(0) === quote && str.charAt(str.length - 1) === quote) {
          str = str.substring(1, str.length - 1);
          return false;
        }
      });
      return str;
    }

    var activeOpts, defaultOpts, insertId = 0;

    function log() {
        if (!(activeOpts && activeOpts.debug)) {
            return;
        }
        var args = [new Date(), "hashsignal"].concat(Array.prototype.slice.apply(arguments));
        if (window.console) {
            window.console.log(args);
        } else {
         alert(args.join(" "));
        }
    }

    defaultOpts = {
        excludeSelector: '.no-ajax',
        beforeUpdate: function() { log('beforeUpdate'); },
        afterUpdate: function() { log('afterUpdate'); },
        errorUpdate: function() { log('errorUpdate'); },
        onDocumentWrite: function(msg) {
          if (window.console) {
            window.console.error("jQuery.hashsignal received document.write: " + msg);
          }
        },
        debug: false,
        disabled: false,
        resolverId: "hashsignal-abs",
        inlineStylesheets: false
    };

    var methods, ALWAYS_RELOAD = '__all__', HASH_REPLACEMENT = ':',
        previousLocation = null, upcomingLocation = null,
        previousSubhash = null,
        transitions = {}, liveFormsSel, document = window.document,
        location = window.location, history = window.history;

    function isCrossDomain(url) {
      // taken straight from jQuery:
      // https://github.com/jquery/jquery/blob/master/src/ajax.js
      var ajaxLocation, ajaxLocParts, parts;
      var rurl = /^([\w\+\.\-]+:)(?:\/\/([^\/?#:]*)(?::(\d+))?)?/;

      try {
        ajaxLocation = window.location.href;
      } catch( e ) {
        ajaxLocation = window.document.createElement( "a" );
        ajaxLocation.href = "";
        ajaxLocation = ajaxLocation.href;
      }

      // Segment location into parts
      ajaxLocParts = rurl.exec( ajaxLocation.toLowerCase() ) || [];
      parts = rurl.exec( url.toLowerCase() );
      return !!( parts &&
        ( parts[ 1 ] != ajaxLocParts[ 1 ] || parts[ 2 ] != ajaxLocParts[ 2 ] ||
          ( parts[ 3 ] || ( parts[ 1 ] === "http:" ? 80 : 443 ) ) !=
          ( ajaxLocParts[ 3 ] || ( ajaxLocParts[ 1 ] === "http:" ? 80 : 443 ) )
        )
      );
    }

    function blockAction(actionName, blockName) {
        /* DRYs up _unloadBlock and _loadBlock below */
        var transition = transitions[blockName];
        if (!transition) {
            return;
        }
        for (var name in transition) {
            if (transition.hasOwnProperty(name)) {
                transition[name][actionName]();
                /* Clean up old transitions which are no longer needed. */
                if( actionName === 'unload' && !transition[name].o.runOnce && blockName != ALWAYS_RELOAD) {
                    delete transition[name];
                }
            }
        }
    }

    function getOldBlocks(doc) {
        function walker(root, handle) {
          handle(root);
          for (var i=0, c=root.childNodes.length; i < c; i++) {
            walker(root.childNodes[i], handle);
          }
        }
        var blockRe = /^ (end)?block ([^ ]*) ([0-9a-f]{32} )?$/;
        function blockWalker(root, handle) { //handle(name, isStart, node)
          walker(root, function(node) {
            if (node.nodeType === 8) { // comment node
              var match = blockRe.exec(node.nodeValue);
              if (match) {
                handle(match[2], match[3], !match[1], node);
              }
            }
          });
        }

        var blocks = {};
        doc = doc || document;
        blockWalker(doc, function(name, signature, isStart, node) {
            if (blocks[name] === undefined) {
                blocks[name] = {
                    nodes: [null, null],
                    signature: signature
                };
            }
            blocks[name].nodes[isStart ? 0 : 1] = node;
        });
        return blocks;
    }

    function getNewBlocks(html, callback) {
        var blocker = /<!-- (end)?block ([^ ]*) ([0123456789abcdef]{32} )?-->/gi;
        var stylesheet = /<link.+?(rel=["']?stylesheet["'\s])?.*?href=["']?(.+?)["'\s].*?(rel=["']?stylesheet["'\s])?.*?>/gi;
        var starts = []; //stack of {name:a, signature:x, start:y};
        var closing;
        var blocks = {}; //name: {signature:x, html:z}
        var stylesheetPromises = [];

        function last() {
          return starts[starts.length-1];
        }

        html.replace(blocker, function(matched, ending, blockName, signatureMaybe, offset, fullString) {
          var blockName;
          if (ending && starts.length === 0) {
            throw "Unexpected block nesting on match: " + matched;
          }
          if (!ending && !signatureMaybe) {
            log('WARNING: block found without signature', blockName);
          }

          if (ending) {
            closing = last();
            blockName = closing.name;
            starts.length = starts.length-1;
            blocks[blockName] = {
              html: fullString.slice(closing.start, offset),
              signature: closing.signature
            };

            if (activeOpts.inlineStylesheets) {
              // begin async loading stylesheets for inline replacement
              blocks[blockName].html.replace(stylesheet, function(sMatched, preRel, href, postRel, offset, sFullString) {
                if (!isCrossDomain(href) && (
                  preRel.toLowerCase().indexOf('stylesheet') !== -1 || postRel.toLowerCase().indexOf('stylesheet') !== -1)
                ) {
                  stylesheetPromises.push($.ajax({
                    dataType: "text",
                    url: href
                  }).done(function(css) {
                    blocks[blockName].html = blocks[blockName].html.replace(sMatched,
                      '<style type="text/css">' + css + '</style>');
                  }));
                }
              });
            }
          } else {
            starts.push({
              name: blockName,
              start: offset + matched.length,
              signature: signatureMaybe
            });
          }
        });
        if (0 !== starts.length) {
          throw "Unclosed block: " + last().name;
        }

        if (stylesheetPromises.length > 0) {
          $.when.apply($, stylesheetPromises).then(function() {
            callback(blocks);
          }, function() {
            callback(blocks);
          });
        } else {
          callback(blocks);
        }
    }

    function replaceBlocks(html, forceReload) {
        log('replaceBlocks');

        function siblingsBetween(start, end) {
            var siblings = [];
            var current = start;
            while (current !== end) {
                if (current !== start) {
                    siblings.push(current);
                }
                current = current.nextSibling;
            }
            return siblings;
        }

        var oldBlocks = getOldBlocks();
        getNewBlocks(html, function(newBlocks) {

          // update title
          var titleRe = /<title>(.*)<\/title>/;
          var titleMatch = titleRe.exec(html);
          if (titleMatch) {
              document.title = titleMatch[1];
          }

          // replace old body attributes with new ones
          var oldBody = $('body'),
              bodyRe = /<body([^>]*)>/,
              bodyMatch = bodyRe.exec(html),
              oldBodyAttrs, newBodyAttrs,
              fakeHtml, newBody;

          if (bodyMatch) {
            fakeHtml = window.document.createElement('html');
            fakeHtml.innerHTML = '<body ' + bodyMatch[1] + '></body>';
            newBody = $('body', fakeHtml);

            function getBodyAttrs(body) {
              var bodyAttrs = {};
              $.each(body.get(0).attributes, function(i, attr) {
                // WARNING: attributes behavior is not very cross-browser friendly.
                // see: http://www.quirksmode.org/dom/w3c_core.html#attributes
                if (!(!!attr && attr.name)) {
                  return;
                }

                var key = attr.name,
                    value = body.attr(key);

                if (value) {
                  bodyAttrs[key] = value;
                }
              });
              return bodyAttrs;
            }
            oldBodyAttrs = getBodyAttrs(oldBody);
            newBodyAttrs = getBodyAttrs(newBody);

            $.each(oldBodyAttrs, function(key, oldValue) {
              var newValue = newBodyAttrs[key];

              if (newValue) {
                if (newValue !== oldValue) {
                  oldBody.attr(key, newValue)
                }
                delete newBodyAttrs[key];
              } else {
                oldBody.removeAttr(key);
              }
            });
            oldBody.attr(newBodyAttrs);
          }

          methods._unloadBlock(ALWAYS_RELOAD);

          for (var blockName in newBlocks) {
              if (blockName in oldBlocks) {
                  var oldBlock = oldBlocks[blockName];
                  var newBlock = newBlocks[blockName];
                  if (oldBlock.signature && newBlock.signature && oldBlock.signature === newBlock.signature && !forceReload) {
                      log('Not replacing block, signatures match.', blockName, oldBlock.signature);
                      continue; // The block is the same, no need to swap out the content.
                  }

                  methods._unloadBlock(blockName);
                  $(siblingsBetween(oldBlock.nodes[0], oldBlock.nodes[1])).remove();

                  log('Replacing block', blockName, newBlock.html);
                  // methods._loadBlock must be called from inside newBlock.html so that mutations block as
                  //   would normally happen with inline scripts.
                  $(oldBlock.nodes[0]).after(newBlock.html +
                  '<script type="text/javascript">' +
                  '  jQuery.hashsignal._loadBlock("' + blockName.replace('"', '\\"') + '");' +
                  '</scr' + 'ipt>' /*+ '<div id="hashsignal-' + insertId + '">&nbsp;</div>'*/);
                  /*if (0 == $("#hashsignal-" + insertId).length) {
                    if (window.console && window.console.error) {
                      window.console.error("Unable to insert into " + blockName + " - is your HTML valid?");
                    }
                  }*/
                  insertId += 1;

                  // update block signature
                  $(oldBlock.nodes[0]).replaceWith("<!-- block " + blockName + " " + (newBlock.signature || "") + "-->");
              } else {
                  log('WARNING: unmatched block', blockName);
              }
          }
          methods._loadBlock(ALWAYS_RELOAD);
        });
    }

    function updatePage(opts) {
        var o = $.extend({
            url: (previousLocation || '') + '#' + (previousSubhash || ''),
            type: 'GET',
            data: '',
            forceReload: false
        }, opts);
        var callbacks = $.extend({
            beforeUpdate: function() { return; },
            afterUpdate: function() { return; },
            errorUpdate: function() { return; }
        }, activeOpts);
        var urlParts = o.url.split("#"), expectedLocation, subhash;

        expectedLocation = urlParts[0] || previousLocation;
        subhash = urlParts[1] || '';
        if (expectedLocation == previousLocation &&
            subhash != previousSubhash) {
            $(window).trigger('hashsignal.hashchange', [subhash]);
            previousSubhash = subhash;
            return;
        }

        if (!o.forceReload && expectedLocation == previousLocation &&
            o.type.toLowerCase() === 'get' && !o.data) {
            return;
        }

        //deal with multiple pending requests by always having the
        // last-requested win, rather than last-responded.
        upcomingLocation = expectedLocation;
        function makeSuccessor(expectedLocation) {
          return function(data, status, xhr) {
              if (expectedLocation != upcomingLocation) {
                  log("Success for ", expectedLocation, " fired but last-requested was ", upcomingLocation, " - aborting");
                  return;
              }
              var jsonData;
              try {
                  jsonData = $.parseJSON(data);
              }
              catch (ex) {};

              // If response body contains a redirect location, perform the redirect.
              // This is an xhr-compatible proxy for 301/302 responses.
              if (jsonData && jsonData.redirectLocation) {
                  log('redirecting page', jsonData.redirectLocation);
                  previousLocation = expectedLocation;
                  previousSubhash = subhash;
                  location.replace('#' + hrefToHash(jsonData.redirectLocation));
                  return;
              }

              setBase(urlPrefix() + expectedLocation);
              replaceBlocks(data, o.forceReload);

              if (subhash) {
                  $(window).trigger('hashsignal.hashchange', [subhash]);
              }
              previousLocation = expectedLocation;
              previousSubhash = subhash;

              callbacks.afterUpdate();
          };
        }

        callbacks.beforeUpdate();
        $.ajax({
            dataType: "text",
            data: o.data,
            error: function(xhr, status, error) {
                log('updatePage error ' + status + " " + error);
                callbacks.errorUpdate(xhr, status, error);
                history.back();
            },
            success: makeSuccessor(expectedLocation),
            beforeSend: function(xhr) {
              xhr.setRequestHeader('X-Hashsignal', 'Hashsignal'); //Used to tell server to send Ajax-friendly redirects.
            },
            type: o.type,
            url: expectedLocation
        });
    }

    function Transition(opts) {
        this.hasRun = false;
        this.o = $.extend({
            load: function(){ return; },
            unload: function() { return; },
            runOnce: false
        }, opts);

        this.events = [];
        this.timeouts = [];
        this.intervals = [];
        this.scripts = {};

        // shims
        this.bind = function(obj, eventType, eventData, handler) {
            this.events.push([obj, eventType, handler]);
            return $(obj).bind(eventType, eventData, handler);
        };
        this.setTimeout = function(callback, timeout) {
            this.timeouts.push(window.setTimeout(callback, timeout));
        };
        this.setInterval = function(callback, timeout) {
            this.intervals.push(window.setInterval(callback, timeout));
        };
        this.clearTimeout = window.clearTimeout;
        this.clearInterval = window.clearInterval;

        this.addScript = function(src, loadOnce) {
            loadOnce = loadOnce === undefined ? true : loadOnce;
            if (!(loadOnce && this.scripts[src])) {
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = src;
                script = $(script);

                var that = this;
                script.load(function(){
                    that.scripts[src] = true;
                    $(this).unbind('load');
                });

                $('body').append(script);
            }
        };

        this.load = function() {
            if (!(this.hasRun && this.runOnce)) {
                this.o.load(this);
            }
            this.hasRun = true;
        };
        this.unload = function() {
            if (!this.runOnce) {
                var i;
                for (i = 0; i < this.events.length; i++) {
                    var e = this.events[i];
                    $(e[0]).unbind(e[1], e[2]);
                }
                for (i = 0; i < this.timeouts.length; i++) {
                    window.clearTimeout(this.timeouts[i]);
                }
                for (i = 0; i < this.intervals.length; i++) {
                    window.clearInterval(this.intervals[i]);
                }
                this.o.unload(this);
            }
        };
    }

    function hrefToHash(href) {
        var parts = href.split("#");
        var subhash = parts[1] || "";
        return parts[0] + HASH_REPLACEMENT + encodeURIComponent(subhash);
    }
    function hashToHref(hash) {
        hash = (hash.charAt(0) === "#" ? hash.substr(1) : hash);
        var subhashIndex = hash.lastIndexOf(HASH_REPLACEMENT);
        var page, subhash;

        if (subhashIndex == -1) {
            return hash;
        } else {
            page = hash.substr(0,subhashIndex);
            subhash = decodeURIComponent(hash.substr(subhashIndex+1));
            return page + (subhash ? "#" + subhash : "");
        }
    }

    function Location(url) {

        // parseUri 1.2.2
        // (c) Steven Levithan <stevenlevithan.com>
        // MIT License

        function parseUri (str) {
            var o   = parseUri.options,
                m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
                uri = {},
                i   = 14;

            while (i--) uri[o.key[i]] = m[i] || "";

            uri[o.q.name] = {};
            uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
                if ($1) uri[o.q.name][$1] = $2;
            });

            return uri;
        }

        parseUri.options = {
            strictMode: false,
            key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
            q:   {
                name:   "queryKey",
                parser: /(?:^|&)([^&=]*)=?([^&]*)/g
            },
            parser: {
                strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
            }
        };

        // end parseUri

        var parts = {
            port: '', // 80
            protocol: '', // http:
            hostname: '', // www.google.com
            pathname: '', // /search
            search: ''  // ?q=devmo
        };
        var that = this;
        var partFunc = function(k) {
            return function(value) {
                if (value === undefined) {
                    return parts[k];
                } else {
                    parts[k] = value;
                }
            };
        }

        for (var k in parts) {
            if (parts.hasOwnProperty(k)) {
                that[k] = partFunc(k);
            }
        }

        parts.hash = '';
        this.hash = function(value) { // #test
            if (value === undefined) {
                return parts.hash;
            } else {
                if (value.length === 0) {
                    parts.hash = '';
                } else {
                    parts.hash = value[0] === '#' ? value : '#' + value;
                }
                return parts.hash;
            }
        };

        this.href = function(value) {  // http://www.google.com:80/search?q=devmo#test
            if (value === undefined) {
                return this.protocol() + '//' + this.host() + this.pathname() + this.search() + this.hash();
            } else {
                var obj = parseUri(value);
                parts = {
                    port: obj.port,
                    protocol: obj.protocol + ':',
                    hostname: obj.host,
                    pathname: obj.path,
                    search: obj.query ? "?" + obj.query : "",
                    hash: obj.anchor ? "#" + obj.anchor : ""
                };
                return this.href();
            }
        };
        this.host = function(value) { // www.google.com:80
            if (value === undefined) {
                var host = this.hostname() + (this.port() === '' ? '' : ':' + this.port());
                return host;
            } else {
                var obj = parseUri(value + this.pathname() + this.search() + this.hash());
                parts.port = obj.port;
                parts.hostname = obj.host;
                return this.host();
            }
        };

        this.relativeHref = function() {
            return this.pathname() + this.search() + this.hash();
        }

        this.href(url); // hook it up!
    }


    function urlPrefix() {
        return location.protocol + "//" + location.host;
    }
    function pathOf(absolute) {
        var domain = urlPrefix() + "/";

        if (0 != absolute.indexOf(domain)) { //off-site, or different protocol.
          return false;
        }
        return "/" + absolute.slice(domain.length);
    }
    function setBase(baseURL, resolverId, callback) {
        var src;
        resolverId = resolverId || activeOpts.resolverId;
        callback = callback || $.noop;
        $("#"+resolverId).remove();
        if ($.browser.mozilla) { //work around https://bugzilla.mozilla.org/show_bug.cgi?id=209275
            src = "src='data:text/html;base64," + window.btoa("<html><head><base href='" + baseURL + "'></head><body></body></html>") + "'";
        } else {
            src = ""
        }
        iframe = $("<iframe style='height:0px;width:0px;display:none' id='" + resolverId + "'" + src + "></iframe>");
        $("body").append(iframe);
        if (!$.browser.mozilla) { //work around content document not being immediately ready.
            setTimeout(function() {
                var childDoc = $("#"+resolverId).get(0).contentWindow.document;
                $("head", childDoc).append($("<base href='" + baseURL + "'>", childDoc));
                callback();
            }, 0);
        } else {
            callback();
        }
    }
    function resolve(url, resolverId) {
        resolverId = resolverId || activeOpts.resolverId;
        var childDoc = $("#" + resolverId).get(0).contentWindow.document;
        $("a", childDoc).remove();
        $("body", childDoc).append($("<p><a href='" + url + "'>&nbsp;</a></p>", childDoc));
        return $("a", childDoc).get(0).href;
    }


    methods = {
        init: function(explicitOpts) {
            activeOpts = $.extend(defaultOpts, explicitOpts);

            if (activeOpts.disabled) {
                // shortcut event binding
                return this;
            }

            document.write = activeOpts.onDocumentWrite;

            $(window).bind('hashchange', function(e){
                log('hashchange', e);
                updatePage({
                    url: hashToHref(location.hash),
                    type: 'GET'
                });
            });
            if (location.hash && location.hash !== '#') {
                updatePage({
                    url: hashToHref(location.hash),
                    type: 'GET'
                });
            }
            $('a:not(' + activeOpts.excludeSelector + ')').live('click', function() {
                var href = resolve(this.getAttribute('href') || ".");

                if (isCrossDomain(href)) { //off-site links act normally.
                  return true;
                }
                var hash = hrefToHash(pathOf(href));
                location.hash = hash;
                return false;
            });

            liveFormsSel = 'form:not(' + activeOpts.excludeSelector + ')';
            $(liveFormsSel).live('submit', function(event) {
                var href = resolve(this.getAttribute('action') || "."),
                    path = pathOf(href);
                if (isCrossDomain(href)) { //off-site forms act normally.
                    return true;
                }

                if ($(this).has("input[type='file']").length) {
                    // we can't serialize files, so we have to do it the old-fashioned way
                    $(this).attr('action', path);
                    return true;
                }

                var type = $(this).attr('method');
                var data = $(this).serialize();
                var submitter = this.submitter;
                if (submitter) {
                    data += (data.length === 0 ? "" : "&") + (
                        encodeURIComponent($(submitter).attr("name"))
                        + "=" + encodeURIComponent($(submitter).attr("value"))
                    );
                }
                log("form submission:", data);
                if (type.toLowerCase() === 'get') {
                    //fix up the querystring.
                    path = path.substring(0, path.indexOf('?')) || path;
                    path += '?' + data;
                    location.hash = hrefToHash(path);
                } else {
                    // TODO: how does a post affect the hash fragment?
                    activeOpts.beforeUpdate();
                    updatePage({
                        url: path,
                        type: type,
                        data: data
                    });
                }
                return false;
            });

            //make sure the submitting button is included in the form data.
            $(liveFormsSel + " input[type=submit], " + liveFormsSel + " button[type=submit]").live('click', function(event) {
              var form = $(this).closest("form").get(0);
              if (form) {
                form.submitter = this;
              }
              return true;
            });
            return this;
        },
        hashchange: function(callback) { // callback = function(e, hash) { ... }
            $(window).bind('hashsignal.hashchange', callback);
            return this;
        },
        location: function(properties) {
            var that = {};
            $(properties).each(function(i, property) {
                that[property] = function(value) {
                    var l = new Location(hashToHref(location.hash));
                    if (!l) {
                        throw "Could not parse current location! " + hashToHref(location.hash);
                    }
                    if (value === undefined) {
                        return l[property]();
                    } else {
                        l[property](value);
                        location.hash = hrefToHash(l.relativeHref());
                    }
                }
            });

            that.assign = that.href; // alias to fully support window.location parity
            that.reload = function() {
                updatePage({
                    forceReload: true
                });
            };
            that.replace = function(url) {
                var l = new Location(url);
                location.replace('#' + hrefToHash(l.relativeHref()));
            };

            return that;
        }(['hash', 'href', 'pathname', 'search']),
        resolveURL: function(url, callback) {
            var clientResolver = activeOpts.resolverId+"-client";
            setBase(urlPrefix() + hashToHref(location.hash), clientResolver, function() {
                callback(resolve(url));
            })
        },
        registerTransition: function(name, blockNames, opts) {
            log('hashsignal.registerTransition', name, blockNames);
            var transition = new Transition(opts);
            if (!!opts.alwaysReload) {
                blockNames = [ALWAYS_RELOAD];
            }
            for (var i = 0; i < blockNames.length; i++) {
                var blockName = blockNames[i];
                if (transitions[blockName] === undefined) {
                    transitions[blockName] = {};
                }
                if (transitions[blockName][name] === undefined) {
                    transitions[blockName][name] = transition;
                }
            }
            return this;
        },
        _unloadBlock: function(blockName) {
            log('hashsignal.unloadBlock', blockName);
            blockAction('unload', blockName);
        },
        _loadBlock: function(blockName) {
            log('hashsignal.loadBlock', blockName);
            blockAction('load', blockName);
        }
    };
    $.hashsignal = methods;
})(window, jQuery);
