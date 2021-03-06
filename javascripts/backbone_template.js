(function() {
  var Template;
  Template = {
    _Genuine: {
      nameLookup: Handlebars.JavaScriptCompiler.prototype.nameLookup,
      mustache: Handlebars.Compiler.prototype.mustache
    },
    _getPath: function(path, base) {
      var parts;
      base = base || window;
      if (!path) {
        throw "Path is undefined or null";
      }
      parts = path.split(".");
      _.each(parts, function(p) {
        base = base[p];
        if (!base) {
          throw "cannot find given path '" + path + "'";
          return {};
        }
      });
      return base;
    },
    _resolveValue: function(attr, model) {
      var model_info, value;
      model_info = Template._resolveIsModel(attr, model);
      value = (function() {
        try {
          return Template._getPath(model_info.attr, model_info.model);
        } catch (error) {
          return null;
        }
      })();
      if (model_info.is_model) {
        return model_info.model.get(model_info.attr);
      } else if (typeof value === "function") {
        return value();
      } else {
        return value;
      }
    },
    _resolveIsModel: function(attr, model) {
      var is_model;
      is_model = false;
      attr = attr.charAt(0) === "@" ? (is_model = true, model = model.model, attr.substring(1)) : attr;
      return {
        is_model: is_model,
        attr: attr,
        model: model
      };
    },
    _bindIf: function(attr, context) {
      var model_info, view;
      if (context) {
        view = new Template._BindView({
          attr: attr,
          model: this
        });
        context.data.exec.addView(view);
        model_info = Template._resolveIsModel(attr, this);
        model_info.model.bind("change:" + model_info.attr, function() {
          view.rerender();
          return context.data.exec.makeAlive();
        });
        view.render = function() {
          var fn;
          fn = Template._resolveValue(this.attr, this.model) ? context.fn : context.inverse;
          return new Handlebars.SafeString(this.span(fn(this.model, null, null, context.data)));
        };
        return view.render();
      } else {
        throw "No block is provided!";
      }
    },
    _createView: function(viewProto, options) {
      var v;
      v = new viewProto(options);
      if (!v) {
        throw "Cannot instantiate view";
      }
      v.span = Template._BindView.prototype.span;
      v.live = Template._BindView.prototype.live;
      v.textAttributes = Template._BindView.prototype.textAttributes;
      v.bvid = "bv-" + (jQuery.uuid++);
      return v;
    },
    _BindView: Backbone.View.extend({
      tagName: "span",
      live: function() {
        return $("[data-bvid='" + this.bvid + "']");
      },
      initialize: function() {
        _.bindAll(this, "render", "rerender", "span", "live", "value", "textAttributes");
        this.bvid = "bv-" + (jQuery.uuid++);
        return this.attr = this.options.attr;
      },
      value: function() {
        return Template._resolveValue(this.attr, this.model);
      },
      textAttributes: function() {
        var attr;
        if (this.renderedAttributes) {
          return this.renderedAttributes;
        }
        this.attributes = this.attributes || this.options.attributes || {};
        if (!this.attributes.id && this.id) {
          this.attributes.id = this.id;
        }
        if (!this.attributes["class"] && this.className) {
          this.attributes["class"] = this.className;
        }
        attr = _.map(this.attributes, function(v, k) {
          return "" + k + "=\"" + v + "\"";
        });
        return this.renderedAttributes = attr.join(" ");
      },
      span: function(inner) {
        return "<" + this.tagName + " " + (this.textAttributes()) + " data-bvid=\"" + this.bvid + "\">" + inner + "</" + this.tagName + ">";
      },
      rerender: function() {
        return this.live().replaceWith(this.render().string);
      },
      render: function() {
        return new Handlebars.SafeString(this.span(this.value()));
      }
    })
  };
  Handlebars.Compiler.prototype.mustache = function(mustache) {
    var id;
    if (mustache.params.length || mustache.hash) {
      return Template._Genuine.mustache.call(this, mustache);
    } else {
      id = new Handlebars.AST.IdNode(['bind']);
      mustache.id.string = "@" + mustache.id.string;
      mustache = new Handlebars.AST.MustacheNode([id].concat([mustache.id]), mustache.hash, !mustache.escaped);
      return Template._Genuine.mustache.call(this, mustache);
    }
  };
  Handlebars.JavaScriptCompiler.prototype.nameLookup = function(parent, name, type) {
    if (type === 'context') {
      return "(context.model.get(\"" + name + "\") ? \"@" + name + "\" : context." + name + ");";
    } else {
      return Template._Genuine.nameLookup.call(this, parent, name, type);
    }
  };
  Backbone.Template = function(template) {
    _.bindAll(this, "addView", "render", "makeAlive");
    this.compiled = Handlebars.compile(template, {
      data: true,
      stringParams: true
    });
    this._createdViews = {};
    this._aliveViews = {};
    this._alive = false;
    return this;
  };
  _.extend(Backbone.Template.prototype, {
    render: function(options) {
      var self;
      self = this;
      return this.compiled(options, null, null, {
        exec: this
      });
    },
    makeAlive: function() {
      var currentViews, query, self;
      query = [];
      currentViews = this._createdViews;
      this._createdViews = {};
      _.each(currentViews, function(view, bvid) {
        return query.push("[data-bvid='" + bvid + "']");
      });
      self = this;
      $(query.join(",")).each(function() {
        var el, view, _ref;
        el = $(this);
        view = currentViews[el.attr("data-bvid")];
        view.el = el;
        view.delegateEvents();
        return (_ref = view.alive) != null ? _ref.call(view) : void 0;
      });
      _.extend(this._aliveViews, currentViews);
      return this._alive = true;
    },
    addView: function(view) {
      return this._createdViews[view.bvid] = view;
    },
    removeView: function(view) {
      delete this._createdViews[view.bvid];
      delete this._aliveViews[view.bvid];
      return delete view;
    }
  });
  Handlebars.registerHelper("view", function(viewName, context) {
    var execContext, v, view;
    execContext = context.data.exec;
    view = Template._getPath(viewName);
    v = Template._createView(view, context.hash);
    execContext.addView(v);
    v.render = function() {
      return new Handlebars.SafeString(this.span(context(this, null, null, context.data)));
    };
    return v.render(v);
  });
  Handlebars.registerHelper("bind", function(attrName, context) {
    var execContext, model_info, view;
    execContext = context.data.exec;
    view = new Template._BindView({
      attr: attrName,
      model: this
    });
    execContext.addView(view);
    model_info = Template._resolveIsModel(attrName, this);
    model_info.model.bind("change:" + model_info.attr, function() {
      view.rerender();
      return execContext.makeAlive();
    });
    return new Handlebars.SafeString(view.render());
  });
  Handlebars.registerHelper("bindAttr", function(context) {
    var attrs, id, outAttrs, self;
    attrs = context.hash;
    id = jQuery.uuid++;
    outAttrs = [];
    self = this;
    _.each(attrs, function(v, k) {
      var attr, model_info, value;
      attr = v;
      model_info = Template._resolveIsModel(attr, self);
      value = Template._resolveValue(attr, self);
      outAttrs.push("" + k + "=\"" + value + "\"");
      return model_info.model.bind("change:" + model_info.attr, function() {
        var el;
        el = $("[data-baid='ba-" + id + "']");
        if (el.length === 0) {
          return model_info.model.unbind("change" + model_info.attr);
        } else {
          return el.attr(k, Template._resolveValue(attr, self));
        }
      });
    });
    outAttrs.push("data-baid=\"ba-" + id + "\"");
    return new Handlebars.SafeString(outAttrs.join(" "));
  });
  Handlebars.registerHelper("if", function(attr, context) {
    return _.bind(Template._bindIf, this)(attr, context);
  });
  Handlebars.registerHelper("unless", function(attr, context) {
    var fn, inverse;
    fn = context.fn;
    inverse = context.inverse;
    context.fn = inverse;
    context.inverse = fn;
    return _.bind(Template._bindIf, this)(attr, context);
  });
  Handlebars.registerHelper("collection", function(attr, context) {
    var colAtts, colTagName, colView, colViewPath, collection, execContext, itemAtts, itemTagName, itemView, itemViewPath, item_view, options, setup, view, views;
    execContext = context.data.exec;
    collection = Template._resolveValue(attr, this);
    if (!(collection.each != null)) {
      throw "not a backbone collection!";
    }
    options = context.hash;
    colViewPath = options != null ? options.colView : void 0;
    if (colViewPath) {
      colView = Template._getPath(colViewPath);
    }
    colTagName = (options != null ? options.colTag : void 0) || "ul";
    itemViewPath = options != null ? options.itemView : void 0;
    if (itemViewPath) {
      itemView = Template._getPath(itemViewPath);
    }
    itemTagName = (options != null ? options.itemTag : void 0) || "li";
    colAtts = {};
    itemAtts = {};
    _.each(options, function(v, k) {
      if (k.indexOf("Tag") > 0 || k.indexOf("View") > 0) {
        return;
      }
      if (k.indexOf("col") === 0) {
        return colAtts[k.substring(3).toLowerCase()] = v;
      } else if (k.indexOf("item") === 0) {
        return itemAtts[k.substring(4).toLowerCase()] = v;
      }
    });
    view = colView ? Template._createView(colView, {
      model: collection,
      attributes: colAtts,
      tagName: (options != null ? options.colTag : void 0) ? colTagName : colView.prototype.tagName
    }) : new Template._BindView({
      tagName: colTagName,
      attributes: colAtts,
      attr: attr,
      model: this
    });
    execContext.addView(view);
    views = {};
    item_view = function(m) {
      var mview;
      mview = itemView ? Template._createView(itemView, {
        model: m,
        attributes: itemAtts,
        tagName: (options != null ? options.itemTag : void 0) ? itemTagName : itemView.prototype.tagName
      }) : new Template._BindView({
        tagName: itemTagName,
        attributes: itemAtts,
        model: m
      });
      execContext.addView(mview);
      mview.render = function() {
        return this.span(context(this, null, null, context.data));
      };
      return mview;
    };
    setup = function(col, mainView, childViews) {
      col.each(function(m) {
        var mview;
        mview = item_view(m);
        return childViews[m.cid] = mview;
      });
      return mainView.render = function() {
        var rendered;
        rendered = _.map(childViews, function(v) {
          return v.render();
        });
        return new Handlebars.SafeString(this.span(rendered.join("\n")));
      };
    };
    setup(collection, view, views);
    collection.bind("refresh", function() {
      views = {};
      setup(collection, view, views);
      view.rerender();
      return execContext.makeAlive();
    });
    collection.bind("add", function(m) {
      var mview;
      mview = item_view(m);
      views[m.cid] = mview;
      view.live().append(mview.render());
      return execContext.makeAlive();
    });
    collection.bind("remove", function(m) {
      var mview;
      mview = views[m.cid];
      mview.live().remove();
      return execContext.removeView(mview);
    });
    return view.render();
  });
}).call(this);
