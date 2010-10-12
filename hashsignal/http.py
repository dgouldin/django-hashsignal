from django.http import HttpResponseRedirect, HttpResponse
from django.utils import simplejson

class AjaxResponseRedirect(HttpResponseRedirect):
    def __init__(self, request, redirect_to):
        if 'HTTP_X_HASHSIGNAL' in request.META:
            content = simplejson.dumps({'redirectLocation': redirect_to})
            HttpResponse.__init__(self, content=content,
                mimetype='application/json', status=200)
        else:
            super(AjaxResponseRedirect, self).__init__(redirect_to)
