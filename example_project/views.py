from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponse
from hashsignal.http import AjaxResponseRedirect

def example_error(request):
    return 1/0

def ajax_redirect(request):
    return AjaxResponseRedirect(request, request.GET.get('to', '/page/1/'))

def middleware_redirect(request):
    return HttpResponseRedirect(request.GET.get('to', '/page/1/'))

def file_upload(request):
    if request.method == 'POST':
        if not request.FILES:
            raise Exception("No files found!")
        else:
            return HttpResponseRedirect('/')
    return render_to_response('file_upload.html')

def form_get(request):
    return render_to_response('form.html', {'submitted': request.GET.get('submitted', "nope"),
                                                "method": "GET"})

def form_post(request):
    return render_to_response('form.html', {'submitted': request.POST.get('submitted', "nope"),
                                                "method": "POST"})