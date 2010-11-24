=================
Django Hashsignal
=================

django-hashsignal aids existing Django projects in the transition to hashsignaling.

What is Hashsignaling?
======================

In a typical website, a browser issues a normal request for a url, a response is issued by the web server, and that response is rendered by the browser.  The url requested is displayed in the address bar once the response is received. Navigating from one page to another looks like this:

http://www.example.com/foo/ -> http://www.example.com/bar/

Hashsignaling works in a similar manner but keeps the user on a single page.  Instead of allowing the browser issuing a normal request, an ajax request is made in its place, and the ajax response is rendered into the existing page to present the facade that the user has navigated to a different url.  In order to preserve the abstraction, the path corresponding to the page currently being displayed to the user is stored in the uri hash fragment.  When using hashsignaling, navigating from one "page" to another looks like this:

http://www.example.com/a/#/foo/ -> http://www.example.com/a/#/bar/

Installation
============

#. Add the ``hashsignal`` directory to your Python path.

#. Add ``hashsignal`` to your ``INSTALLED_APPS`` setting.

#. Add the following middleware to your project's ``settings.py`` file:

   ``'hashsignal.middleware.AjaxRedirectMiddleware',``

#. Override ``TEMPLATE_LOADERS``, adding the following **as the first template loader**:

   ``'hashsignal.loaders.AjaxLoader',``

#. Copy or symlink ``hashsignal/media/js`` into media service tree.

#. Add script tags for ``jquery.ba-hashchange.min.js`` and ``jquery.hashsignal.js`` to the base template.

Implementation
==============

#. In any templates implementing hashsignaling, add ``{% load hashsignal %}``. Replace ``{% block %}`` tags with ``{% ajaxblock %}`` for any blocks which should be loaded via hashsignaling.

#. Add an urlconf item which uses Django's direct_to_template generic view to render the base template. (This will be referred to as the hashsignal container.)

#. In the base template, add javascript to the document's head to redirect any url that is not the hashsignal container to a hashsignal container url including the requested path in the uri hash fragment.  (See an example in `example_project <https://github.com/dgouldin/django-hashsignal/blob/master/example_project/templates/base.html#L9>`_.)

#. Register any javascript specific to parts of the page loaded by hashsignaling using ``jQuery.hashsignal.registerTransition``.  (See `jQuery.hashsignal`_ below.)

jQuery.hashsignal
=================

As an effect of hashsignaling, javascript is never automatically unloaded and reloaded as it is during normal browser navigation.  Since the hashsignal container's lifecycle is indefinite, measures must be taken to ensure the state of the container's loaded javascript remains sane.

jQuery.hashsignal is a jQuery plugin which provides tools to deal with the affects of an abnormally long page lifecycle and dynamically shifting dom structure.

TODO: jQuery.hashsignal API docs.
