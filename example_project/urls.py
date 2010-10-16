import os

from django.conf import settings
from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^$', 'django.views.generic.simple.direct_to_template',
        {'template': 'homepage.html'}),
    url(r'error/$', 'views.example_error'),
    url(r'^page/1/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'page1.html'}),
    url(r'^page/2/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'page2.html'}),
    url(r'^page:3/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'page3.html'}),        
    url(r'redirect/ajax/$', 'views.ajax_redirect'),
    url(r'redirect/middleware/$', 'views.middleware_redirect'),
    url(r'upload/$', 'views.file_upload'),
    url(r'form/get/$', 'views.form_get'),
    url(r'form/post/$', 'views.form_post'),
    url(r'^a/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'base.html'}),
    url(r'^site_media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': os.path.join(settings.REPO_ROOT, 'hashsignal/media/')}),
)
