from hashsignal.http import AjaxResponseRedirect

def example_error(request):
    return 1/0

def example_redirect(request):
    return AjaxResponseRedirect(request, request.GET.get('to', '/page/1/'))
