jQuery.log = function() {
    var args = [new Date()].concat(Array.prototype.slice.apply(arguments));
    if (window.console) {
        window.console.log(args);
    } else {
        return; // TODO: replacement for console.log
    }
};

jQuery.lifecycle = {
    ALWAYS_RELOAD: '__all__',
    HASH_REPLACEMENT: ':',
    previousLocation: null,
    hashchange: function(callback) { // callback = function(e, hash) { ... }
        jQuery(window).bind('lifecycle.hashchange', callback);
    },
    updatePage: function(url, type, data, opts) {
        type = type || 'GET';
        data = data || '';
        callbacks = $.extend({
            beforeUpdate: function() { return; },
            afterUpdate: function() { return; },
            errorUpdate: function() { return; },
        }, opts);

        var urlParts = url.split(jQuery.lifecycle.HASH_REPLACEMENT);
        url = urlParts[0];
        var hash = null;
        if (urlParts.length > 1) {
            hash = urlParts[1];
        }

        if (url == jQuery.lifecycle.previousLocation && hash && type.toLowerCase() === 'get' && !data) {
            // Only hash, not page, needs to be updated
            jQuery(window).trigger('lifecycle.hashchange', [hash]);
            return;
        }

        callbacks.beforeUpdate();
        //deal with multiple pending requests by always having the 
        // last-requested win, rather than last-responded.
        jQuery.lifecycle.upcomingLocation = url;
        function makeSuccessor(url) {
          return function(data, status, xhr) {
              if (url != jQuery.lifecycle.upcomingLocation) {
                jQuery.log("Handler for ", url, " fired but last-requested was ", jQuery.lifecycle.upcomingLocation, " - aborting");
                return;
              }
              jQuery.log('updatePage success');
              jQuery.lifecycle.replaceBlocks(data);

              if (hash) {
                  jQuery(window).trigger('lifecycle.hashchange', [hash]);
              }
              jQuery.lifecycle.previousLocation = url;
              callbacks.afterUpdate();
          }
        }

        jQuery.ajax({
            data: data,
            error: function(xhr, status, error) {
                jQuery.log('updatePage error');
                callbacks.errorUpdate();
            },
            success: makeSuccessor(url),
            type: type,
            url: url
        });
    },
    bootstrap: function(opts) {
        var o = jQuery.extend({
            selector: '.no-ajax',
            beforeUpdate: function() { jQuery.log('beforeUpdate'); },
            afterUpdate: function() { jQuery.log('afterUpdate'); },
            errorUpdate: function() { jQuery.log('errorUpdate'); },
        }, opts);
        jQuery(window).bind('hashchange', function(h){
            jQuery.log('hashchange');
            jQuery.lifecycle.updatePage(location.hash.substr(1), 'GET', '', o);
        });
        if (location.hash && location.hash !== '#') {
            jQuery.log('hash', location.hash);
            jQuery.lifecycle.updatePage(location.hash.substr(1), 'GET', '', o);
        }
        jQuery('a:not(' + o.selector + ')').live('click', function(){
            var href = jQuery(this).attr('href').replace('#', jQuery.lifecycle.HASH_REPLACEMENT);
            if (href.indexOf(jQuery.lifecycle.HASH_REPLACEMENT) === 0) {
                // link is relative to the current page
                href = window.location.hash.substr(1).split(jQuery.lifecycle.HASH_REPLACEMENT)[0] + href;
            }
            window.location.hash = '#' + href;
            return false;
        });
        var forms = jQuery('form:not(' + o.selector + ')')
        forms.live('submit', function(event){
            var url = jQuery(this).attr('action');
            var type = jQuery(this).attr('method');
            var data = jQuery(this).serialize();
            var submitter = this.submitter;
            if (submitter) {
              data += "&" + jQuery(submitter).attr("name") + "=" + jQuery(submitter).attr("value");
            }
            jQuery.log("submit event", data);
            if (url === '.') {
                url = window.location.hash.substr(1);
            }

            if (type.toLowerCase() === 'get') {
                url = url.substring(0, url.indexOf('?')) || url;
                url += '?' + data;
                window.location.hash = '#' + url;
            } else {
                // TODO: how does a post affect the hash fragment?
                o.beforeUpdate();
                jQuery.lifecycle.updatePage(url, type, data, o.afterUpdate, o.errorUpdate);
            }
            return false;
        });
        //make sure the submitting button is included in the form data.
        forms.find('input[type=submit],button[type=submit]').live('click', function(event) {
          $(this).closest("form").get(0).submitter = this;
        })
    },
    cycles: {},
    Cycle: function(opts) {
        this.hasRun = false;
        this.o = jQuery.extend({
            load: function(){ return; }, // no-op
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
            return jQuery(obj).bind(eventType, eventData, handler);
        };
        this.setTimeout = function(callback, timeout) {
            this.timeouts.push(setTimeout(callback, timeout));
        };
        this.setInterval = function(callback, timeout) {
            this.intervals.push(setInterval(callback, timeout));
        };
        this.clearTimeout = window.clearTimeout;
        this.clearInterval = window.clearInterval;        
        this.addScript = function(src, loadOnce) {
            loadOnce = loadOnce === undefined ? true : loadOnce;
            if (!(loadOnce && this.scripts[src])) {
                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = src;
                script = jQuery(script);

                var that = this;
                script.load(function(){
                    that.scripts[src] = true;
                    jQuery(this).unbind('load');
                });

                jQuery('body').append(script);
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
                    jQuery(e[0]).unbind(e[1], e[2]);
                }
                for (i = 0; i < this.timeouts.length; i++) {
                    clearTimeout(this.timeouts[i]);
                }
                for (i = 0; i < this.intervals.length; i++) {
                    clearInterval(this.intervals[i]);
                }
                this.o.unload(this);
            }
        };
    },
    register: function(name, blockNames, opts) {
        jQuery.log('lifecycle.register', name, blockNames);
        var cycle = new jQuery.lifecycle.Cycle(opts);
        if (!!opts.alwaysReload) {
            blockNames = [jQuery.lifecycle.ALWAYS_RELOAD];
        }
        for (var i = 0; i < blockNames.length; i++) {
            var blockName = blockNames[i];
            if (jQuery.lifecycle.cycles[blockName] === undefined) {
                jQuery.lifecycle.cycles[blockName] = {};
            }
            if (jQuery.lifecycle.cycles[blockName][name] === undefined) {
                jQuery.lifecycle.cycles[blockName][name] = cycle;
            }
        }
    },
    _blockAction: function(blockAction, blockName) {
        if (!jQuery.lifecycle.cycles[blockName]) {
            return;
        }
        for (var name in jQuery.lifecycle.cycles[blockName]) {
            if (jQuery.lifecycle.cycles[blockName].hasOwnProperty(name)) {
                jQuery.lifecycle.cycles[blockName][name][blockAction]();
                if( blockAction === 'unload' && !jQuery.lifecycle.cycles[blockName][name].o.runOnce && blockName != jQuery.lifecycle.ALWAYS_RELOAD) {
                    delete jQuery.lifecycle.cycles[blockName][name];
                }
            }
        }
    },
    unloadBlock: function(blockName) {
        jQuery.log('lifecycle.unloadBlock', blockName);
        jQuery.lifecycle._blockAction('unload', blockName);
    },
    loadBlock: function(blockName) {
        jQuery.log('lifecycle.loadBlock', blockName);
        jQuery.lifecycle._blockAction('load', blockName);
    },
    getOldBlocks: function(doc) {
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
        blockWalker(doc, function(name, hash, isStart, node) {
            if (blocks[name] === undefined) {
                blocks[name] = {
                    nodes: [null, null],
                    hash: hash
                };
            }
            blocks[name].nodes[isStart ? 0 : 1] = node;
        });
        return blocks;
    },
    getNewBlocks: function(html) {
        var blocker = /<!-- (end)?block ([^ ]*) ([0123456789abcdef]{32} )?-->/gi;
        var starts = []; //stack of {name:a, hash:x, start:y};
        var closing;
        var blocks = {}; //name: {hash:x, html:z}

        function last() {
          return starts[starts.length-1];
        }

        html.replace(blocker, function(matched, ending, blockName, hashMaybe, offset, fullString) {
          if (ending && starts.length === 0) {
            throw "Unexpected block nesting on match: " + matched;
          }
          if (!ending && !hashMaybe) {
            throw "Expected hash on start of block";
          }

          if (ending) {
            closing = last();
            starts.length = starts.length-1;
            blocks[closing.name] = {
              html: fullString.slice(closing.start, offset),
              hash: closing.hash
            };
          } else {
            starts.push({
              name: blockName,
              start: offset + matched.length,
              hash: hashMaybe
            });
          }
        });
        if (0 !== starts.length) {
          throw "Unclosed block: " + last().name;
        }
        return blocks;
    },
    replaceBlocks: function(html) {
        jQuery.log('replaceBlocks');

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

        var oldBlocks = jQuery.lifecycle.getOldBlocks();
        var newBlocks = jQuery.lifecycle.getNewBlocks(html);

        jQuery.lifecycle.unloadBlock(jQuery.lifecycle.ALWAYS_RELOAD);

        for (var blockName in newBlocks) {
            if (blockName in oldBlocks) {
                var oldBlock = oldBlocks[blockName];
                var newBlock = newBlocks[blockName];
                if (oldBlock.hash === newBlock.hash) {
                    jQuery.log('Not replacing block, hashes match.', blockName, oldBlock.hash);
                    continue; // The block is the same, no need to swap out the content.
                }

                jQuery.lifecycle.unloadBlock(blockName);
                jQuery(siblingsBetween(oldBlock.nodes[0], oldBlock.nodes[1])).remove();

                jQuery.log('Replacing block', blockName, newBlock.html);
                // loadBlock to be called from inside newBlock.html
                jQuery(oldBlock.nodes[0]).after(newBlock.html +
                '<script type="text/javascript">' +
                '  jQuery.lifecycle.loadBlock("' + blockName.replace('"', '\\"') + '");' +
                '</scr' + 'ipt>'); // oh javascript ...
                
                // update block hash
                jQuery(oldBlock.nodes[0]).replaceWith("<!-- block " + blockName + " " + newBlock.hash + "-->");
            } else {
                jQuery.log('WARNING: unmatched block', blockName);
            }
        }
        jQuery.lifecycle.loadBlock(jQuery.lifecycle.ALWAYS_RELOAD);

        // update title
        var titleRe = /<title>(.*)<\/title>/;
        var titleMatch = titleRe.exec(html);
        if (titleMatch) {
            document.title = titleMatch[1];
        }
    },
    loadCurrentBlocks: function() {
        var oldBlocks = jQuery.lifecycle.getOldBlocks();
        for (var blockName in oldBlocks) {
            jQuery.lifecycle.loadBlock(blockName);
        }
        jQuery.lifecycle.loadBlock(jQuery.lifecycle.ALWAYS_RELOAD);
    }
};
