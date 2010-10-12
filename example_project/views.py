from django.http import HttpResponseRedirect
from hashsignal.http import AjaxResponseRedirect

def example_error(request):
    return 1/0

def ajax_redirect(request):
    return AjaxResponseRedirect(request, request.GET.get('to', '/page/1/'))

def middleware_redirect(request):
    return HttpResponseRedirect(request.GET.get('to', '/page/1/'))
