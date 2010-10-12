import os.path
import sys

PROJECT_ROOT = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, '..'))
sys.path.insert(0, REPO_ROOT)

DEBUG = True
TEMPLATE_DEBUG = DEBUG
MEDIA_URL = '/site_media/'
SECRET_KEY = '#y+k_=h!xo-)cve3nxi!6_hxo=ts!*d1fhwbpmsbvvo9^fka42'
TEMPLATE_LOADERS = (
    'hashsignal.loaders.AjaxLoader',
    'django.template.loaders.filesystem.Loader',
    'django.template.loaders.app_directories.Loader',
)
MIDDLEWARE_CLASSES = (
    'django.middleware.common.CommonMiddleware',
    'hashsignal.middleware.AjaxRedirectMiddleware'
)
ROOT_URLCONF = 'example_project.urls'
TEMPLATE_DIRS = (
    os.path.join(PROJECT_ROOT, 'templates'),
)
INSTALLED_APPS = (
    'hashsignal',
)
