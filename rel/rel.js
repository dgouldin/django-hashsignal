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
        search: '',  // ?q=devmo
        hash: ''  // #test
    };
    var that = this;
    $.each(parts, function(k, v) {
        that[k] = function(value) {
            if (value === undefined) {
                return parts[k];
            } else {
                parts[k] = value;
            }
        };
    });

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

function resolveRelative(target, base) {
    if (-1 != target.indexOf(':')) { //new scheme is always absolute.
        return target;
    }
    // starting with scheme, keep same protocol.
    if (target.substr(0,2) == "//") { // //foo.com -> http://foo.com
        return location.protocol + target;
    }
    if (target === "") {
        return base;
    }
    if (target === ".") {
        var temp = base.split("/");
        temp[temp.length-1] = "";
        return temp.join("/");
    }

    /*
    var targetPath;

    var baseL = new Location(base);

    if (target[0] === "#") {
        return baseL.protocol() + "//" + baseL.host() + baseL.pathname() + baseL.search() + target;
    }

    var basePathParts = baseL.pathname().split("/");

    var pending = basePathParts.concat(targetPathParts);
    var final = [];
    var rootDir = false;

    for (var i=0,l=pending.length; i<l; i++) {
        if (pending[i] == ".") {
            if (final.length > 0) {
                continue;
            } else {
                rootDir = true;
            }
        } else if (pending[i] == "..") {
            final.pop();
        } else {

            final.push(pending[i]);
        }
    }

    //FIXME: loads not covered here yet.
    */

    return target;
}

function test(rel, base, expected) {
    var result = resolveRelative(rel, base);
    var msg;
    if (result != expected) {
        msg = ["rel of '", rel, "' based on '", base, "' expecting", expected, "actual", result];
        console.error.apply(console, msg);
    } else {
        msg = ["PASSED rel of '", rel, "' based on '", base, "' expecting", expected];
        console.log.apply(console, msg);
    }
}

/*
based on:
    http://tools.ietf.org/html/rfc3986#section-5.4
*/
var base = "http://a/b/c/d;p?q";

test("g:h", base, "g:h")
test("g", base, "http://a/b/c/g")
test("./g", base, "http://a/b/c/g")
test("g/", base, "http://a/b/c/g/")
test("/g", base, "http://a/g")
test("//g", base, "http://g")
test("?y", base, "http://a/b/c/d;p?y")
test("g?y", base, "http://a/b/c/g?y")
test("#s", base, "http://a/b/c/d;p?q#s")
test("g#s", base, "http://a/b/c/g#s")
test("g?y#s", base, "http://a/b/c/g?y#s")
test(";x", base, "http://a/b/c/;x")
test("g;x", base, "http://a/b/c/g;x")
test("g;x?y#s", base, "http://a/b/c/g;x?y#s")
test("", base, "http://a/b/c/d;p?q")
test(".", base, "http://a/b/c/")
test("./", base, "http://a/b/c/")
test("..", base, "http://a/b/")
test("../", base, "http://a/b/")
test("../g", base, "http://a/b/g")
test("../..", base, "http://a/")
test("../../", base, "http://a/")
test("../../g", base, "http://a/g")
test("../../../g", base, "http://a/g")
test("../../../../g", base, "http://a/g")
test("/./g", base, "http://a/g")
test("/../g", base, "http://a/g")
test("g.", base, "http://a/b/c/g.")
test(".g", base, "http://a/b/c/.g")
test("g..", base, "http://a/b/c/g..")
test("..g", base, "http://a/b/c/..g")
test("./../g", base, "http://a/b/g")
test("./g/.", base, "http://a/b/c/g/")
test("g/./h", base, "http://a/b/c/g/h")
test("g/../h", base, "http://a/b/c/h")
test("g;x=1/./y", base, "http://a/b/c/g;x=1/y")
test("g;x=1/../y", base, "http://a/b/c/y")
test("g?y/./x", base, "http://a/b/c/g?y/./x")
test("g?y/../x", base, "http://a/b/c/g?y/../x")
test("g#s/./x", base, "http://a/b/c/g#s/./x")
test("g#s/../x", base, "http://a/b/c/g#s/../x")
//extras based on de-facto behavior:
test("//foo.com/bar", base, "http://foo.com/bar")
