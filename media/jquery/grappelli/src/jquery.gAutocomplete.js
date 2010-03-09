/*  Author:  Maxime Haineault <max@motion-m.ca>
 *  widget:  gAutocomplete
 *  Package: Grappelli
 *  Todo:
 *   - Caching
 *
 *  jslinted - 8 Jan 2010
 * */
(function($){

$.fn.prevOrLast = function() {
    return $(this).prev().length > 0 && $(this).prev() || $(this).parent().children(':last');
};
$.fn.nextOrFirst = function() {
    return $(this).next().length > 0 && $(this).next() || $(this).parent().children(':first');
};

$.widget('ui.gAutocomplete', {

    _lastRequest: 0,
    _results: [],
    _select_onload: false,
    _ignored_chars: [106, 107, 108, 109, 110, 111, 13, 16, 17, 188, 190, 20, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 45, 9],

    _init: function() {
        var ui, width;
        ui = this;
        ui.dom = {
            wrapper: ui._createElement('div',   {ns: 'wrapper'}).addClass('ui-corner-bottom').hide(), 
            results: ui._createElement('ul',    {ns: 'results'}), 
            input:   ui._createElement('input', {ns: 'autocomplete', attr:{type: 'text'}}).addClass('vAutocompleteSearchField'), 
            browse:  ui._createElement('button',     {ns: 'browse', attr:{href: ui.options.related_url, title: 'Browse'}}) 
        };
        
        ui.element.hide().parent().find('.vAutocompleteRawIdAdminField').hide();
        ui.element.attr('name', ui.element.attr('id'));
        ui.dom.input.insertAfter(ui.element);

        // Initial value
        if (ui.element.val()) {
            ui.dom.input.val(ui.element.val());
        }

        if (ui.options.width) {
            ui.dom.input.width(ui.options.width);
        }

        width = ui.dom.input.width() + parseInt(ui.dom.input.css('padding-left').slice(0, -2), 10) + parseInt(ui.dom.input.css('padding-right').slice(0, -2), 10);

        if (ui.options.browse) {
            ui.dom.browse.insertAfter(ui.dom.input).attr('id', 'lookup_id_'+ ui.element.attr('id'))
                .hover(function(){ $(this).addClass('ui-state-hover'); }, function(){ $(this).removeClass('ui-state-hover'); })
                .bind('click.browse', function(){
                    return ui._browse(this); 
                });

            ui.dom.input
                .bind('focus.browse', function(){ ui.dom.browse.addClass('focus'); })
                .bind('blur.browse',  function(){ ui.dom.browse.removeClass('focus'); });
        }

        ui.dom.wrapper
            .append(ui.dom.results)
            .insertAfter(ui.dom.input)
            .css('left', ui.dom.input.position().left)
            .width(width);
        
        ui._bind(ui.dom.input, 'keydown', function(e){
            var kc = e.keyCode || 0;
            var key = $.ui.keyCode;
            switch(kc) {
                case key.UP:     return ui._select('prev');
                case key.DOWN:   return ui._select('next');
                case key.ENTER:  e.preventDefault(); return ui._choose();
                case key.ESCAPE: return ui._cancel();
                default:
                return true;
            }
        });

        ui.dom.input.delayedObserver(function(e){
            var kc = e.keyCode || 0;
            // Option: minChar
            if ($(this).val().length >= ui.options.minChars) { 
                if ($.inArray(kc, ui._ignored_chars) < 0) {
                    ui._autocomplete();
                }
            }
            else {
                ui.dom.wrapper.hide();
                ui._selected().removeClass('selected');
                if ($(this).val().length === 0) {
                    ui._setVal();
                }
            }
        }, ui.options.delay);
    },

    /* called when the "Browse" button is clicked on
     * Autocomplete fields
     */
    _browse: function(l) {
        var link = $(l);
        var href = link.attr('href') + ((link.attr('href').search(/\?/) >= 0) && '&' || '?') + 'pop=1';
        var wm   = $.wm(href, {height: 600 , width: 920, resizable: true, scrollbars: true});
        wm._data('element', link.prevAll('input:first'));
        wm.open();
        return false;
    },

    /* Set the current widget value
     * @val the value to be set (must be an object that 
     *      contains a "id" and a "label" property)
     **/
    _setVal: function(val) {
        var ui = this;
        if (val) {
            $('[name="'+ ui.element.attr('id') +'"]').val(val.id);
            ui.dom.input.val($.format(ui.options.inputFormat, val));
        }
        else {
            $('[name="'+ ui.element.attr('id') +'"]').val('');
            ui.dom.input.val('');
        }
    },

    /* Creates an HTML fragment
     * @type    the element type (ex: "div", "p", "b"...)
     * @attr    an array of attributes to apply
     **/
    _createElement: function(type, options) {
        var ui = this;
        var el = $('<'+ type +' />');
        var op = options || {};
        if (op.ns)           { el.addClass(ui.widgetBaseClass +'-'+ op.ns); }
        if (op.attr)         { el.attr(op.attr); }
        return el;
    },

    /*  Shortcut to bind an event to the
     *  widget element
     **/
    _bind: function(element, eventName, callback) {
        var ui = this; 
        element.bind(eventName +'.'+ ui.widgetEventPrefix, function(e){
            return callback.apply(this, [e, ui]);
        });
    },
    
    /* Hide the autocomplete result list
     **/
    _hideList: function() {
        var ui = this;
        if (ui.dom.wrapper.is(':visible')){
            ui.dom.wrapper.hide();
            $('html').unbind('click.gAutocomplete');
        }
    },

    /* Show the autocomplete result list
     **/
    _showList: function(){
        var ui = this;
        if (ui.dom.wrapper.is(':hidden')){
            ui.dom.wrapper.show();
            $('html').bind('click.gAutocomplete', function(e){
                if (!$(e.target).hasClass('ui-gAutocomplete-autocomplete')) {
                    ui._hideList();
                }
            });
        }
    },

    /* Called when a selection has been made
     **/
    _select: function(which) {
        var ui = this;
        var li = false;
        ui._showList();
        var selected = ui._selected();
        if (selected.length > 0) {
            li = selected.removeClass('selected')[(which == 'prev' && 'prevOrLast' || 'nextOrFirst')]();
        }
        else {
            li = ui.dom.results.find((which == 'prev' && 'li:last-child' || 'li:first-child')).addClass('selected');
        }
        li.addClass('selected');
        ui._choose(true);
        return true;
    },
            

    /*  Returns the currently selected "li" element
     **/
    _selected: function() {
        return this.dom.results.find('li.selected');
    },

    /* Called when the input value has been changed.
     * Then updates the results list.
     * */
    _autocomplete: function() {
        var ui  = this;
        var url = ui.options.backend +'?q='+ ui.dom.input.val();
        var lr  = ++ui._lastRequest;

        // Option: maxResults
        if (ui.options.maxResults) {
            url = url + '&limit='+ ui.options.maxResults;
        }
        // Option: throbber
        if (ui.options.throbber) {
            ui.dom.input.addClass('searching');
        }
        ui._showList();
        $.getJSON(url, function(json, responseStatus){
            // process the request only if it's successful and it's the last sent (avoid race conditions)
            ui.dom.input.removeClass('searching');
            if (responseStatus == 'success' && lr == ui._lastRequest) {
                ui._results = json;
                ui._redraw();
            }
        });
    },


    /*  Return the cached results list
     **/
    results: function() {
        return this._results;         
    },

    _choose: function(nonSticky) {
        var ui = this;
        var node = ui.dom.results.find('.selected');
        if (node.data('json')) {
            ui._setVal(node.data('json'));
            if (nonSticky) { // remember value in case of cancel
                ui.dom.input.data('sticky', ui.dom.input.val());
            }
            else {
                ui._hideList();
            }
        }
        ui.element.trigger($.Event({type: 'complete', sticky: !nonSticky, data: node.data('json')}));
        return false;
    },


    /* This method is called to cancel a complete operation, for
     * example, if the user presses "Esc" or "Tab" while autocompleting.
     * */
    _cancel: function() {
        var ui = this;
        ui.dom.results.find('.selected').removeClass('selected');
        if (ui.dom.input.data('sticky')) {
            ui.dom.input.val(ui.dom.input.data('sticky'));
            ui.dom.input.data('sticky', false);
        }
        ui._hideList();
        return false;
    },

    /*  This method must be called when a new results list
     *  as been loaded. It will update the autocomplete list
     *  with the new results.
     **/
    _redraw: function() {
        var ui = this;
        var li, item, txt = false;
        var rs = ui.options.maxResults && ui._results.slice(0, ui.options.maxResults) || ui._results;
        var liMouseMove = function() { ui._shiftSelection(item); };
        var liClick = function() { ui._shiftSelection(item)._choose(); };
        ui.element.trigger('redraw');
        ui.dom.results.empty();

        if (rs.length > 0) {
            for (var x=0; x<rs.length; x++) {
                item = rs[x];
                txt  = $.format(ui.options.listFormat, item);
                li   = ui._createElement('li', {ns: 'result'}).data('json', item).appendTo(ui.dom.results);

                // Option: highlight
                if (ui.options.highlight) {
                    li.html(txt.replace(new RegExp("("+ ui.dom.input.val() +")", "gi"),'<b>$1</b>'));
                }
                else {
                    li.text(txt);
                }
                ui.dom.input.removeClass('no-match');
                ui.dom.results.find('.selected').removeClass('selected');
                ui._bind(li, 'mouseover', liMouseMove);
                ui._bind(li, 'click',     liClick);
            }
            ui._showList();
        }
        else {
            ui.dom.input.addClass('no-match');
             if (ui.options.create) {
                li = ui._createElement('li', {ns: 'result'}).data('create', true);
                li.text(ui.options.createText);
                ui.dom.results.html(li);
                ui._showList();
             }
        }
        ui.element.trigger('redrawn');
    },
    
    /* Take a LI element, mark it as selected and
     * mark its siblings as not-selected
     * */
    _shiftSelection: function(el) {
        $(el).addClass('selected').siblings().removeClass('selected');
        return this;
    }
});

$.extend($.ui.gAutocomplete, {
    getter: 'results',
    defaults: {
        // tested
        highlight:  true,
        
        // non-tested
        browse:     true,
        throbber:   true,
        delay:      0.5,
        minChars:   2,
        maxResults: 20,
        width:      false,
        browseIcon: 'search', // see http://jqueryui.com/themeroller/ for available icons
        create:     false, // buggy
        createText: 'Create a new object',
        lookup_url: '/grappelli/lookup/related/'
    }
});


})(jQuery);
