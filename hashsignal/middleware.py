from django.http import HttpResponse
from django.utils import simplejson

class AjaxRedirectMiddleware(object):
    def process_response(self, request, response):
        if 'HTTP_X_HASHSIGNAL' in request.META and \
            response.status_code in (301, 302):
            content = simplejson.dumps({
                'redirectLocation': response['Location']
            })
            return HttpResponse(content=content,
                mimetype='application/json', status=200)
        else:
            return response