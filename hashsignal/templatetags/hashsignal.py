from hashlib import md5

from django.template import Library, TemplateSyntaxError
from django.template.loader_tags import BlockNode, BLOCK_CONTEXT_KEY
from django.utils import simplejson
from django.utils.safestring import mark_safe

register = Library()

class AjaxBlockNode(BlockNode):
    def render(self, context):
        block_context = context.render_context.get(BLOCK_CONTEXT_KEY)
        if block_context:
            blocks = context.render_context[BLOCK_CONTEXT_KEY].blocks.get(self.name, [self])
            block_unique_name = '%s:%s' % (self.name, blocks[0].template.name)
        else:
            block_unique_name = '%s:%s' % (self.name, self.template.name)

        if 'ajaxblocks' not in context:
            context['ajaxblocks'] = []
        context['ajaxblocks'].append(block_unique_name)
        result = super(AjaxBlockNode, self).render(context)
        context['ajaxblocks'].pop()

        content_hash = md5(result.encode('utf-8')).hexdigest()
        return """
        <!-- block %(block_unique_name)s %(content_hash)s -->
        %(contents)s
        <!-- endblock %(block_unique_name)s -->
        """ % {
            'block_unique_name': block_unique_name,
            'content_hash': content_hash,
            'contents': result,
        }

    def __repr__(self):
        return "<Ajax Block Node: %s. Contents: %r>" % (self.name, self.nodelist)

def do_ajaxblock(parser, token):
    """
    Copy of django.template.loader_tags.do_block
    """
    bits = token.contents.split()
    if len(bits) != 2:
        raise TemplateSyntaxError("'%s' tag takes only one argument" % bits[0])
    block_name = bits[1]
    # Keep track of the names of BlockNodes found in this template, so we can
    # check for duplication.
    try:
        if block_name in parser.__loaded_blocks:
            raise TemplateSyntaxError("'%s' tag with name '%s' appears more than once" % (bits[0], block_name))
        parser.__loaded_blocks.append(block_name)
    except AttributeError: # parser.__loaded_blocks isn't a list yet
        parser.__loaded_blocks = [block_name]
    nodelist = parser.parse(('endblock', 'endblock %s' % block_name))
    parser.delete_first_token()
    return AjaxBlockNode(block_name, nodelist)

def json(value):
    return mark_safe(simplejson.dumps(value))

register.tag('ajaxblock', do_ajaxblock)
register.filter('json', json)

