from django.template import TemplateSyntaxError
from django.template.loaders.filesystem import Loader
from django.template.loader_tags import IncludeNode, ConstantIncludeNode

def patch_node(node, template):
    if hasattr(node, 'template'):
        if isinstance(node, IncludeNode) or isinstance(node, ConstantIncludeNode):
            return;
        raise TemplateSyntaxError, "Revisited node in patch_parent_template!"
    node.template = template
    for nodelist_attr in node.child_nodelists:
        nodelist = getattr(node, nodelist_attr, [])
        for child_node in nodelist:
            patch_node(child_node, template)

class AjaxLoader(Loader):
    def load_template(self, *args, **kwargs):
        template, display_name = super(AjaxLoader, self).load_template(*args, **kwargs)
        if not hasattr(template, 'render'):
            return template, display_name
        for node in template.nodelist:
            patch_node(node, template)
        return template, display_name
