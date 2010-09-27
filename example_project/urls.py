import os

from django.conf import settings
from django.conf.urls.defaults import *

urlpatterns = patterns('',
    url(r'^$', 'django.views.generic.simple.direct_to_template',
        {'template': 'homepage.html'}),
    url(r'^page/1/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'page1.html'}),
    url(r'^page/2/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'page2.html'}),
    url(r'error/$', 'views.exampleError'),
    url(r'^a/$', 'django.views.generic.simple.direct_to_template',
        {'template': 'base.html'}),
    url(r'^site_media/(?P<path>.*)$', 'django.views.static.serve',
        {'document_root': os.path.join(settings.REPO_ROOT, 'hashsignal/media/')}),
)
