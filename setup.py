#!/usr/bin/env python

from setuptools import setup, find_packages

setup(
    name='django-hashsignal',
    version='.'.join(map(str, __import__('hashsignal').__version__)),
    author='David Gouldin, Jeremy Dunck',
    author_email='david@gould.in, jdunck@gmail.com',
    url='http://github.com/dgouldin/django-hashsignal',
    description = 'Tools for making a hash-signaling powered Django site.',
    packages=find_packages(),
    zip_safe=False,
    install_requires=[],
    include_package_data=True,
    classifiers=[
        'Framework :: Django',
        'Intended Audience :: Developers',
        'Operating System :: OS Independent',
        'Topic :: Software Development'
    ],
)