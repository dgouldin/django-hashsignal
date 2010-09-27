/*
Requires
  * jQuery hashchange event - v1.2 - 2/11/2010
  * http://benalman.com/projects/jquery-hashchange-plugin/
*/

(function(window, $, undefined){
    var activeOpts, defaultOpts;

    function log() {
        if (!(activeOpts && activeOpts.debug)) {
            return;
        }
        var args = [new Date(), "hashsignal"].concat(Array.prototype.slice.apply(arguments));
        if (window.console) {
            window.console.log(args);
        } else {
         return; // TODO: replacement for console.log
        }
    }
    
    defaultOpts = {
        excludeSelector: '.no-ajax',
        beforeUpdate: function() { log('beforeUpdate'); },
        afterUpdate: function() { log('afterUpdate'); },
        errorUpdate: function() { log('errorUpdate'); },
        debug: false
    };

    var methods, ALWAYS_RELOAD = '__all__', HASH_REPLACEMENT = ':',
        previousLocation = null, upcomingLocation = null,
        transitions = {}, liveForms, document = window.document,
        location = window.location;

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
    
    function getNewBlocks(html) {
        var blocker = /<!-- (end)?block ([^ ]*) ([0123456789abcdef]{32} )?-->/gi;
        var starts = []; //stack of {name:a, signature:x, start:y};
        var closing;
        var blocks = {}; //name: {signature:x, html:z}

        function last() {
          return starts[starts.length-1];
        }

        html.replace(blocker, function(matched, ending, blockName, signatureMaybe, offset, fullString) {
          if (ending && starts.length === 0) {
            throw "Unexpected block nesting on match: " + matched;
          }
          if (!ending && !signatureMaybe) {
            throw "Expected signature on start of block";
          }

          if (ending) {
            closing = last();
            starts.length = starts.length-1;
            blocks[closing.name] = {
              html: fullString.slice(closing.start, offset),
              signature: closing.signature
            };
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
        return blocks;
    }
    
    function replaceBlocks(html) {
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
        var newBlocks = getNewBlocks(html);

        methods._unloadBlock(ALWAYS_RELOAD);

        for (var blockName in newBlocks) {
            if (blockName in oldBlocks) {
                var oldBlock = oldBlocks[blockName];
                var newBlock = newBlocks[blockName];
                if (oldBlock.signature === newBlock.signature) {
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
                '  jQuery.hashsignal(\'_loadBlock\', "' + blockName.replace('"', '\\"') + '");' +
                '</scr' + 'ipt>'); // oh javascript ...

                // update block signature
                $(oldBlock.nodes[0]).replaceWith("<!-- block " + blockName + " " + newBlock.signature + "-->");
            } else {
                log('WARNING: unmatched block', blockName);
            }
        }
        methods._loadBlock(ALWAYS_RELOAD);

        // update title
        var titleRe = /<title>(.*)<\/title>/;
        var titleMatch = titleRe.exec(html);
        if (titleMatch) {
            document.title = titleMatch[1];
        }
    }

    function updatePage(url, type, data, opts) {
        type = type || 'GET';
        data = data || '';
        var callbacks = $.extend({
            beforeUpdate: function() { return; },
            afterUpdate: function() { return; },
            errorUpdate: function() { return; }
        }, opts);

        var urlParts = url.split(HASH_REPLACEMENT);
        url = urlParts[0];

        var subhash = urlParts[1] || '';
        if (url == previousLocation && subhash && type.toLowerCase() === 'get' && !data) {
            // Only hash, not page, needs to be updated
            $(window).trigger('hashsignal.hashchange', [subhash]);
            return;
        }

        //deal with multiple pending requests by always having the 
        // last-requested win, rather than last-responded.
        upcomingLocation = url;
        function makeSuccessor(url) {
          return function(data, status, xhr) {
              if (url != upcomingLocation) {
                log("Success for ", url, " fired but last-requested was ", upcomingLocation, " - aborting");
                return;
              }

              log('updatePage onSuccess');
              replaceBlocks(data);

              if (subhash) {
                  $(window).trigger('hashsignal.hashchange', [subhash]);
              }
              previousLocation = url;
              callbacks.afterUpdate();
          };
        }

        callbacks.beforeUpdate();
        $.ajax({
            data: data,
            error: function(xhr, status, error) {
                log('updatePage error');
                callbacks.errorUpdate(xhr, status, error);
                location.hash = "#" + previousLocation;
            },
            success: makeSuccessor(url),
            type: type,
            url: url
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

    methods = {
        init: function(explicitOpts) {
            activeOpts = $.extend(defaultOpts, explicitOpts);

            $(window).hashchange(function(h){
                log('hashchange');
                updatePage(location.hash.substr(1), 'GET', '', activeOpts);
            });

            if (location.hash && location.hash !== '#') {
                log('existing hash', location.hash);
                updatePage(location.hash.substr(1), 'GET', '', activeOpts);
            }
            $('a:not(' + activeOpts.excludeSelector + ')').live('click', function(){
                var href = $(this).attr('href').replace('#', HASH_REPLACEMENT);
                if (href.indexOf(HASH_REPLACEMENT) === 0) {
                    // link is relative to the current page
                    href = window.location.hash.substr(1).split(HASH_REPLACEMENT)[0] + href;
                }
                window.location.hash = '#' + href;
                return false;
            });
            liveForms = $('form:not(' + activeOpts.excludeSelector + ')');
            liveForms.live('submit', function(event){
                var url = $(this).attr('action');
                var type = $(this).attr('method');
                var data = $(this).serialize();
                var submitter = this.submitter;
                if (submitter) {
                    data += (data.length === 0 ? "?" : "&") + (
                        encodeURIComponent($(submitter).attr("name")) 
                        + "=" + encodeURIComponent($(submitter).attr("value"))
                    );
                }
                log("form submission:", data);
                if (url === '.') {
                    url = window.location.hash.substr(1);
                }
                if (type.toLowerCase() === 'get') {
                    url = url.substring(0, url.indexOf('?')) || url;
                    url += '?' + data;
                    window.location.hash = '#' + url;
                } else {
                    // TODO: how does a post affect the hash fragment?
                    activeOpts.beforeUpdate();
                    updatePage(url, type, data, activeOpts);
                }
                return false;
            });
            //make sure the submitting button is included in the form data.
            liveForms.find('input[type=submit],button[type=submit]').live('click', function(event) {
              $(this).closest("form").get(0).submitter = this;
            });
            return this;
        },
        hashchange: function(callback) { // callback = function(e, hash) { ... }
            $(window).bind('hashsignal.hashchange', callback);
            return this;
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
    $.hashsignal = function( method ) {
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply( this, arguments );
        } else {
            $.error('Method ' +  method + ' does not exist on jQuery.hashsignal');
        }
    };
})(window, jQuery);
