!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Slideout=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

/**
 * Module dependencies
 */
var decouple = require('decouple');
var Emitter = require('emitter');

/**
 * Privates
 */
var scrollTimeout;
var scrolling = false;
var doc = window.document;
var html = doc.documentElement;
var msPointerSupported = window.navigator.msPointerEnabled;
var touch = {
  'start': msPointerSupported ? 'MSPointerDown' : 'touchstart',
  'move': msPointerSupported ? 'MSPointerMove' : 'touchmove',
  'end': msPointerSupported ? 'MSPointerUp' : 'touchend'
};
var prefix = (function prefix() {
  var regex = /^(Webkit|Khtml|Moz|ms|O)(?=[A-Z])/;
  var styleDeclaration = doc.getElementsByTagName('script')[0].style;
  for (var prop in styleDeclaration) {
    if (regex.test(prop)) {
      return '-' + prop.match(regex)[0].toLowerCase() + '-';
    }
  }
  // Nothing found so far? Webkit does not enumerate over the CSS properties of the style object.
  // However (prop in style) returns the correct value, so we'll have to test for
  // the precence of a specific property
  if ('WebkitOpacity' in styleDeclaration) { return '-webkit-'; }
  if ('KhtmlOpacity' in styleDeclaration) { return '-khtml-'; }
  return '';
}());
function extend(destination, from) {
  for (var prop in from) {
    if (from[prop]) {
      destination[prop] = from[prop];
    }
  }
  return destination;
}
function inherits(child, uber) {
  child.prototype = extend(child.prototype || {}, uber.prototype);
}

/**
 * Slideout constructor
 */
function Slideout(options) {
  options = options || {};

  // Sets default values
  this._startOffsetX = 0;
  this._currentOffsetX = 0;
  this._opening = false;
  this._moved = false;
  this._opened = false;
  this._preventOpen = false;
  this._touch = options.touch === undefined ? true : options.touch && true;

  // Sets panel
  this.panel = options.panel;
  this.menu = options.menu;

  // Sets  classnames
  if(this.panel.className.search('slideout-panel') === -1) { this.panel.className += ' slideout-panel'; }
  if(this.menu.className.search('slideout-menu') === -1) { this.menu.className += ' slideout-menu'; }


  // Sets options
  this._fx = options.fx || 'ease';
  this._duration = parseInt(options.duration, 10) || 300;
  this._tolerance = parseInt(options.tolerance, 10) || 70;
  this._padding = this._translateTo = parseInt(options.padding, 10) || 256;
  this._closeOnClick = options.closeOnClick || false;
  this._grabWidth = parseInt(options.grabWidth, 10) || 0;
  this._orientation = options.side === 'right' ? -1 : 1;
  this._translateTo *= this._orientation;

  // Init touch events
  if (this._touch) {
    this._initTouchEvents();
  }
  
  if (this._closeOnClick) {
    /**
     * Close menu when panel is clicked while open
     */
    this.panel.addEventListener('click', function() {
      if (self.isOpen) { self.close(); }
    });
  }
}

/**
 * Inherits from Emitter
 */
inherits(Slideout, Emitter);

/**
 * Opens the slideout menu.
 */
Slideout.prototype.open = function() {
  var self = this;
  this.emit('beforeopen');
  if (html.className.search('slideout-open') === -1) { html.className += ' slideout-open'; }
  this._setTransition();
  this._translateXTo(this._translateTo);
  this._opened = true;
  setTimeout(function() {
    self.panel.style.transition = self.panel.style['-webkit-transition'] = '';
    self.emit('open');
  }, this._duration + 50);
  return this;
};

/**
 * Closes slideout menu.
 */
Slideout.prototype.close = function() {
  var self = this;
  if (!this.isOpen() && !this._opening) {
    return this;
  }
  this.emit('beforeclose');
  this._setTransition();
  this._translateXTo(0);
  this._opened = false;
  setTimeout(function() {
    html.className = html.className.replace(/ slideout-open/, '');
    self.panel.style.transition = self.panel.style['-webkit-transition'] = self.panel.style[prefix + 'transform'] = self.panel.style.transform = '';
    self.emit('close');
  }, this._duration + 50);
  return this;
};

/**
 * Toggles (open/close) slideout menu.
 */
Slideout.prototype.toggle = function() {
  return this.isOpen() ? this.close() : this.open();
};

/**
 * Returns true if the slideout is currently open, and false if it is closed.
 */
Slideout.prototype.isOpen = function() {
  return this._opened;
};

/**
 * Translates panel and updates currentOffset with a given X point
 */
Slideout.prototype._translateXTo = function(translateX) {
  this._currentOffsetX = translateX;
  this.panel.style[prefix + 'transform'] = this.panel.style.transform = 'translateX(' + translateX + 'px)';
  return this;
};

/**
 * Set transition properties
 */
Slideout.prototype._setTransition = function() {
  this.panel.style[prefix + 'transition'] = this.panel.style.transition = prefix + 'transform ' + this._duration + 'ms ' + this._fx;
  return this;
};

/**
 * Initializes touch event
 */
Slideout.prototype._initTouchEvents = function() {
  var self = this;

  /**
   * Decouple scroll event
   */
  this._onScrollFn = decouple(doc, 'scroll', function() {
    if (!self._moved) {
      clearTimeout(scrollTimeout);
      scrolling = true;
      scrollTimeout = setTimeout(function() {
        scrolling = false;
      }, 250);
    }
  });

  /**
   * Prevents touchmove event if slideout is moving
   */
  this._preventMove = function(eve) {
    if (self._moved) {
      eve.preventDefault();
    }
  };

  doc.addEventListener(touch.move, this._preventMove);

  /**
   * Resets values on touchstart
   */
  this._resetTouchFn = function(eve) {
    if (typeof eve.touches === 'undefined') {
      return;
    }

    self._moved = false;
    self._opening = false;
    var offset = eve.touches[0].pageX;
    self._startOffsetX = offset;
    self._preventOpen = (!self._touch || (!self.isOpen() && self.menu.clientWidth !== 0)  || (self._grabWidth && offset > self._grabWidth));
  };

  this.panel.addEventListener(touch.start, this._resetTouchFn);

  /**
   * Resets values on touchcancel
   */
  this._onTouchCancelFn = function() {
    self._moved = false;
    self._opening = false;
  };

  this.panel.addEventListener('touchcancel', this._onTouchCancelFn);

  /**
   * Toggles slideout on touchend
   */
  this._onTouchEndFn = function() {
    if (self._moved) {
      self.emit('translateend');
      (self._opening && Math.abs(self._currentOffsetX) > self._tolerance) ? self.open() : self.close();
    }
    self._moved = false;
  };

  this.panel.addEventListener(touch.end, this._onTouchEndFn);

  /**
   * Translates panel on touchmove
   */
  this._onTouchMoveFn = function(eve) {

    if (scrolling || self._preventOpen || typeof eve.touches === 'undefined') {
      return;
    }

    var dif_x = eve.touches[0].clientX - self._startOffsetX;
    var translateX = self._currentOffsetX = dif_x;

    if (Math.abs(translateX) > self._padding) {
      return;
    }

    if (Math.abs(dif_x) > 20) {

      self._opening = true;

      var oriented_dif_x = dif_x * self._orientation;

      if (self._opened && oriented_dif_x > 0 || !self._opened && oriented_dif_x < 0) {
        return;
      }

      if (!self._moved) {
        self.emit('translatestart');
      }

      if (oriented_dif_x <= 0) {
        translateX = dif_x + self._padding * self._orientation;
        self._opening = false;
      }

      if (!self._moved && html.className.search('slideout-open') === -1) {
        html.className += ' slideout-open';
      }

      self.panel.style[prefix + 'transform'] = self.panel.style.transform = 'translateX(' + translateX + 'px)';
      self.emit('translate', translateX);
      self._moved = true;
    }

  };

  this.panel.addEventListener(touch.move, this._onTouchMoveFn);

  return this;
};

/**
 * Enable opening the slideout via touch events.
 */
Slideout.prototype.enableTouch = function() {
  this._touch = true;
  return this;
};

/**
 * Disable opening the slideout via touch events.
 */
Slideout.prototype.disableTouch = function() {
  this._touch = false;
  return this;
};

/**
 * Destroy an instance of slideout.
 */
Slideout.prototype.destroy = function() {
  // Close before clean
  this.close();

  // Remove event listeners
  doc.removeEventListener(touch.move, this._preventMove);
  this.panel.removeEventListener(touch.start, this._resetTouchFn);
  this.panel.removeEventListener('touchcancel', this._onTouchCancelFn);
  this.panel.removeEventListener(touch.end, this._onTouchEndFn);
  this.panel.removeEventListener(touch.move, this._onTouchMoveFn);
  doc.removeEventListener('scroll', this._onScrollFn);

  // Remove methods
  this.open = this.close = function() {};

  // Return the instance so it can be easily dereferenced
  return this;
};

/**
 * Expose Slideout
 */
module.exports = Slideout;

},{"decouple":2,"emitter":3}],2:[function(require,module,exports){
'use strict';

var requestAnimFrame = (function() {
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
}());

function decouple(node, event, fn) {
  var eve,
      tracking = false;

  function captureEvent(e) {
    eve = e;
    track();
  }

  function track() {
    if (!tracking) {
      requestAnimFrame(update);
      tracking = true;
    }
  }

  function update() {
    fn.call(node, eve);
    tracking = false;
  }

  node.addEventListener(event, captureEvent, false);

  return captureEvent;
}

/**
 * Expose decouple
 */
module.exports = decouple;

},{}],3:[function(require,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;
/**
 * Creates a new instance of Emitter.
 * @class
 * @returns {Object} Returns a new instance of Emitter.
 * @example
 * // Creates a new instance of Emitter.
 * var Emitter = require('emitter');
 *
 * var emitter = new Emitter();
 */

var Emitter = (function () {
  function Emitter() {
    _classCallCheck(this, Emitter);
  }

  /**
   * Adds a listener to the collection for the specified event.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to add.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Add an event listener to "foo" event.
   * emitter.on('foo', listener);
   */

  Emitter.prototype.on = function on(event, listener) {
    // Use the current collection or create it.
    this._eventCollection = this._eventCollection || {};

    // Use the current collection of an event or create it.
    this._eventCollection[event] = this._eventCollection[event] || [];

    // Appends the listener into the collection of the given event
    this._eventCollection[event].push(listener);

    return this;
  };

  /**
   * Adds a listener to the collection for the specified event that will be called only once.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to add.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Will add an event handler to "foo" event once.
   * emitter.once('foo', listener);
   */

  Emitter.prototype.once = function once(event, listener) {
    var self = this;

    function fn() {
      self.off(event, fn);
      listener.apply(this, arguments);
    }

    fn.listener = listener;

    this.on(event, fn);

    return this;
  };

  /**
   * Removes a listener from the collection for the specified event.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The event name.
   * @param {Function} listener - A listener function to remove.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Remove a given listener.
   * emitter.off('foo', listener);
   */

  Emitter.prototype.off = function off(event, listener) {

    var listeners = undefined;

    // Defines listeners value.
    if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
      return this;
    }

    listeners.forEach(function (fn, i) {
      if (fn === listener || fn.listener === listener) {
        // Removes the given listener.
        listeners.splice(i, 1);
      }
    });

    // Removes an empty event collection.
    if (listeners.length === 0) {
      delete this._eventCollection[event];
    }

    return this;
  };

  /**
   * Execute each item in the listener collection in order with the specified data.
   * @memberof! Emitter.prototype
   * @function
   * @param {String} event - The name of the event you want to emit.
   * @param {...Object} data - Data to pass to the listeners.
   * @returns {Object} Returns an instance of Emitter.
   * @example
   * // Emits the "foo" event with 'param1' and 'param2' as arguments.
   * emitter.emit('foo', 'param1', 'param2');
   */

  Emitter.prototype.emit = function emit(event) {
    var _this = this;

    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    var listeners = undefined;

    // Defines listeners value.
    if (!this._eventCollection || !(listeners = this._eventCollection[event])) {
      return this;
    }

    // Clone listeners
    listeners = listeners.slice(0);

    listeners.forEach(function (fn) {
      return fn.apply(_this, args);
    });

    return this;
  };

  return Emitter;
})();

/**
 * Exports Emitter
 */
exports["default"] = Emitter;
module.exports = exports["default"];
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3NlcmlmeVxcbm9kZV9tb2R1bGVzXFxicm93c2VyLXBhY2tcXF9wcmVsdWRlLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXNcXGRlY291cGxlXFxpbmRleC5qcyIsIm5vZGVfbW9kdWxlc1xcZW1pdHRlclxcZGlzdFxcaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3VUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbi8qKlxyXG4gKiBNb2R1bGUgZGVwZW5kZW5jaWVzXHJcbiAqL1xyXG52YXIgZGVjb3VwbGUgPSByZXF1aXJlKCdkZWNvdXBsZScpO1xyXG52YXIgRW1pdHRlciA9IHJlcXVpcmUoJ2VtaXR0ZXInKTtcclxuXHJcbi8qKlxyXG4gKiBQcml2YXRlc1xyXG4gKi9cclxudmFyIHNjcm9sbFRpbWVvdXQ7XHJcbnZhciBzY3JvbGxpbmcgPSBmYWxzZTtcclxudmFyIGRvYyA9IHdpbmRvdy5kb2N1bWVudDtcclxudmFyIGh0bWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xyXG52YXIgbXNQb2ludGVyU3VwcG9ydGVkID0gd2luZG93Lm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkO1xyXG52YXIgdG91Y2ggPSB7XHJcbiAgJ3N0YXJ0JzogbXNQb2ludGVyU3VwcG9ydGVkID8gJ01TUG9pbnRlckRvd24nIDogJ3RvdWNoc3RhcnQnLFxyXG4gICdtb3ZlJzogbXNQb2ludGVyU3VwcG9ydGVkID8gJ01TUG9pbnRlck1vdmUnIDogJ3RvdWNobW92ZScsXHJcbiAgJ2VuZCc6IG1zUG9pbnRlclN1cHBvcnRlZCA/ICdNU1BvaW50ZXJVcCcgOiAndG91Y2hlbmQnXHJcbn07XHJcbnZhciBwcmVmaXggPSAoZnVuY3Rpb24gcHJlZml4KCkge1xyXG4gIHZhciByZWdleCA9IC9eKFdlYmtpdHxLaHRtbHxNb3p8bXN8TykoPz1bQS1aXSkvO1xyXG4gIHZhciBzdHlsZURlY2xhcmF0aW9uID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXS5zdHlsZTtcclxuICBmb3IgKHZhciBwcm9wIGluIHN0eWxlRGVjbGFyYXRpb24pIHtcclxuICAgIGlmIChyZWdleC50ZXN0KHByb3ApKSB7XHJcbiAgICAgIHJldHVybiAnLScgKyBwcm9wLm1hdGNoKHJlZ2V4KVswXS50b0xvd2VyQ2FzZSgpICsgJy0nO1xyXG4gICAgfVxyXG4gIH1cclxuICAvLyBOb3RoaW5nIGZvdW5kIHNvIGZhcj8gV2Via2l0IGRvZXMgbm90IGVudW1lcmF0ZSBvdmVyIHRoZSBDU1MgcHJvcGVydGllcyBvZiB0aGUgc3R5bGUgb2JqZWN0LlxyXG4gIC8vIEhvd2V2ZXIgKHByb3AgaW4gc3R5bGUpIHJldHVybnMgdGhlIGNvcnJlY3QgdmFsdWUsIHNvIHdlJ2xsIGhhdmUgdG8gdGVzdCBmb3JcclxuICAvLyB0aGUgcHJlY2VuY2Ugb2YgYSBzcGVjaWZpYyBwcm9wZXJ0eVxyXG4gIGlmICgnV2Via2l0T3BhY2l0eScgaW4gc3R5bGVEZWNsYXJhdGlvbikgeyByZXR1cm4gJy13ZWJraXQtJzsgfVxyXG4gIGlmICgnS2h0bWxPcGFjaXR5JyBpbiBzdHlsZURlY2xhcmF0aW9uKSB7IHJldHVybiAnLWtodG1sLSc7IH1cclxuICByZXR1cm4gJyc7XHJcbn0oKSk7XHJcbmZ1bmN0aW9uIGV4dGVuZChkZXN0aW5hdGlvbiwgZnJvbSkge1xyXG4gIGZvciAodmFyIHByb3AgaW4gZnJvbSkge1xyXG4gICAgaWYgKGZyb21bcHJvcF0pIHtcclxuICAgICAgZGVzdGluYXRpb25bcHJvcF0gPSBmcm9tW3Byb3BdO1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gZGVzdGluYXRpb247XHJcbn1cclxuZnVuY3Rpb24gaW5oZXJpdHMoY2hpbGQsIHViZXIpIHtcclxuICBjaGlsZC5wcm90b3R5cGUgPSBleHRlbmQoY2hpbGQucHJvdG90eXBlIHx8IHt9LCB1YmVyLnByb3RvdHlwZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTbGlkZW91dCBjb25zdHJ1Y3RvclxyXG4gKi9cclxuZnVuY3Rpb24gU2xpZGVvdXQob3B0aW9ucykge1xyXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAvLyBTZXRzIGRlZmF1bHQgdmFsdWVzXHJcbiAgdGhpcy5fc3RhcnRPZmZzZXRYID0gMDtcclxuICB0aGlzLl9jdXJyZW50T2Zmc2V0WCA9IDA7XHJcbiAgdGhpcy5fb3BlbmluZyA9IGZhbHNlO1xyXG4gIHRoaXMuX21vdmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fb3BlbmVkID0gZmFsc2U7XHJcbiAgdGhpcy5fcHJldmVudE9wZW4gPSBmYWxzZTtcclxuICB0aGlzLl90b3VjaCA9IG9wdGlvbnMudG91Y2ggPT09IHVuZGVmaW5lZCA/IHRydWUgOiBvcHRpb25zLnRvdWNoICYmIHRydWU7XHJcblxyXG4gIC8vIFNldHMgcGFuZWxcclxuICB0aGlzLnBhbmVsID0gb3B0aW9ucy5wYW5lbDtcclxuICB0aGlzLm1lbnUgPSBvcHRpb25zLm1lbnU7XHJcblxyXG4gIC8vIFNldHMgIGNsYXNzbmFtZXNcclxuICBpZih0aGlzLnBhbmVsLmNsYXNzTmFtZS5zZWFyY2goJ3NsaWRlb3V0LXBhbmVsJykgPT09IC0xKSB7IHRoaXMucGFuZWwuY2xhc3NOYW1lICs9ICcgc2xpZGVvdXQtcGFuZWwnOyB9XHJcbiAgaWYodGhpcy5tZW51LmNsYXNzTmFtZS5zZWFyY2goJ3NsaWRlb3V0LW1lbnUnKSA9PT0gLTEpIHsgdGhpcy5tZW51LmNsYXNzTmFtZSArPSAnIHNsaWRlb3V0LW1lbnUnOyB9XHJcblxyXG5cclxuICAvLyBTZXRzIG9wdGlvbnNcclxuICB0aGlzLl9meCA9IG9wdGlvbnMuZnggfHwgJ2Vhc2UnO1xyXG4gIHRoaXMuX2R1cmF0aW9uID0gcGFyc2VJbnQob3B0aW9ucy5kdXJhdGlvbiwgMTApIHx8IDMwMDtcclxuICB0aGlzLl90b2xlcmFuY2UgPSBwYXJzZUludChvcHRpb25zLnRvbGVyYW5jZSwgMTApIHx8IDcwO1xyXG4gIHRoaXMuX3BhZGRpbmcgPSB0aGlzLl90cmFuc2xhdGVUbyA9IHBhcnNlSW50KG9wdGlvbnMucGFkZGluZywgMTApIHx8IDI1NjtcclxuICB0aGlzLl9jbG9zZU9uQ2xpY2sgPSBvcHRpb25zLmNsb3NlT25DbGljayB8fCBmYWxzZTtcclxuICB0aGlzLl9ncmFiV2lkdGggPSBwYXJzZUludChvcHRpb25zLmdyYWJXaWR0aCwgMTApIHx8IDA7XHJcbiAgdGhpcy5fb3JpZW50YXRpb24gPSBvcHRpb25zLnNpZGUgPT09ICdyaWdodCcgPyAtMSA6IDE7XHJcbiAgdGhpcy5fdHJhbnNsYXRlVG8gKj0gdGhpcy5fb3JpZW50YXRpb247XHJcblxyXG4gIC8vIEluaXQgdG91Y2ggZXZlbnRzXHJcbiAgaWYgKHRoaXMuX3RvdWNoKSB7XHJcbiAgICB0aGlzLl9pbml0VG91Y2hFdmVudHMoKTtcclxuICB9XHJcbiAgXHJcbiAgaWYgKHRoaXMuX2Nsb3NlT25DbGljaykge1xyXG4gICAgLyoqXHJcbiAgICAgKiBDbG9zZSBtZW51IHdoZW4gcGFuZWwgaXMgY2xpY2tlZCB3aGlsZSBvcGVuXHJcbiAgICAgKi9cclxuICAgIHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcclxuICAgICAgaWYgKHNlbGYuaXNPcGVuKSB7IHNlbGYuY2xvc2UoKTsgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogSW5oZXJpdHMgZnJvbSBFbWl0dGVyXHJcbiAqL1xyXG5pbmhlcml0cyhTbGlkZW91dCwgRW1pdHRlcik7XHJcblxyXG4vKipcclxuICogT3BlbnMgdGhlIHNsaWRlb3V0IG1lbnUuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUub3BlbiA9IGZ1bmN0aW9uKCkge1xyXG4gIHZhciBzZWxmID0gdGhpcztcclxuICB0aGlzLmVtaXQoJ2JlZm9yZW9wZW4nKTtcclxuICBpZiAoaHRtbC5jbGFzc05hbWUuc2VhcmNoKCdzbGlkZW91dC1vcGVuJykgPT09IC0xKSB7IGh0bWwuY2xhc3NOYW1lICs9ICcgc2xpZGVvdXQtb3Blbic7IH1cclxuICB0aGlzLl9zZXRUcmFuc2l0aW9uKCk7XHJcbiAgdGhpcy5fdHJhbnNsYXRlWFRvKHRoaXMuX3RyYW5zbGF0ZVRvKTtcclxuICB0aGlzLl9vcGVuZWQgPSB0cnVlO1xyXG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XHJcbiAgICBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zaXRpb24gPSBzZWxmLnBhbmVsLnN0eWxlWyctd2Via2l0LXRyYW5zaXRpb24nXSA9ICcnO1xyXG4gICAgc2VsZi5lbWl0KCdvcGVuJyk7XHJcbiAgfSwgdGhpcy5fZHVyYXRpb24gKyA1MCk7XHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogQ2xvc2VzIHNsaWRlb3V0IG1lbnUuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgaWYgKCF0aGlzLmlzT3BlbigpICYmICF0aGlzLl9vcGVuaW5nKSB7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbiAgdGhpcy5lbWl0KCdiZWZvcmVjbG9zZScpO1xyXG4gIHRoaXMuX3NldFRyYW5zaXRpb24oKTtcclxuICB0aGlzLl90cmFuc2xhdGVYVG8oMCk7XHJcbiAgdGhpcy5fb3BlbmVkID0gZmFsc2U7XHJcbiAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgIGh0bWwuY2xhc3NOYW1lID0gaHRtbC5jbGFzc05hbWUucmVwbGFjZSgvIHNsaWRlb3V0LW9wZW4vLCAnJyk7XHJcbiAgICBzZWxmLnBhbmVsLnN0eWxlLnRyYW5zaXRpb24gPSBzZWxmLnBhbmVsLnN0eWxlWyctd2Via2l0LXRyYW5zaXRpb24nXSA9IHNlbGYucGFuZWwuc3R5bGVbcHJlZml4ICsgJ3RyYW5zZm9ybSddID0gc2VsZi5wYW5lbC5zdHlsZS50cmFuc2Zvcm0gPSAnJztcclxuICAgIHNlbGYuZW1pdCgnY2xvc2UnKTtcclxuICB9LCB0aGlzLl9kdXJhdGlvbiArIDUwKTtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBUb2dnbGVzIChvcGVuL2Nsb3NlKSBzbGlkZW91dCBtZW51LlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLnRvZ2dsZSA9IGZ1bmN0aW9uKCkge1xyXG4gIHJldHVybiB0aGlzLmlzT3BlbigpID8gdGhpcy5jbG9zZSgpIDogdGhpcy5vcGVuKCk7XHJcbn07XHJcblxyXG4vKipcclxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBzbGlkZW91dCBpcyBjdXJyZW50bHkgb3BlbiwgYW5kIGZhbHNlIGlmIGl0IGlzIGNsb3NlZC5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5pc09wZW4gPSBmdW5jdGlvbigpIHtcclxuICByZXR1cm4gdGhpcy5fb3BlbmVkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFRyYW5zbGF0ZXMgcGFuZWwgYW5kIHVwZGF0ZXMgY3VycmVudE9mZnNldCB3aXRoIGEgZ2l2ZW4gWCBwb2ludFxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLl90cmFuc2xhdGVYVG8gPSBmdW5jdGlvbih0cmFuc2xhdGVYKSB7XHJcbiAgdGhpcy5fY3VycmVudE9mZnNldFggPSB0cmFuc2xhdGVYO1xyXG4gIHRoaXMucGFuZWwuc3R5bGVbcHJlZml4ICsgJ3RyYW5zZm9ybSddID0gdGhpcy5wYW5lbC5zdHlsZS50cmFuc2Zvcm0gPSAndHJhbnNsYXRlWCgnICsgdHJhbnNsYXRlWCArICdweCknO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldCB0cmFuc2l0aW9uIHByb3BlcnRpZXNcclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5fc2V0VHJhbnNpdGlvbiA9IGZ1bmN0aW9uKCkge1xyXG4gIHRoaXMucGFuZWwuc3R5bGVbcHJlZml4ICsgJ3RyYW5zaXRpb24nXSA9IHRoaXMucGFuZWwuc3R5bGUudHJhbnNpdGlvbiA9IHByZWZpeCArICd0cmFuc2Zvcm0gJyArIHRoaXMuX2R1cmF0aW9uICsgJ21zICcgKyB0aGlzLl9meDtcclxuICByZXR1cm4gdGhpcztcclxufTtcclxuXHJcbi8qKlxyXG4gKiBJbml0aWFsaXplcyB0b3VjaCBldmVudFxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLl9pbml0VG91Y2hFdmVudHMgPSBmdW5jdGlvbigpIHtcclxuICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gIC8qKlxyXG4gICAqIERlY291cGxlIHNjcm9sbCBldmVudFxyXG4gICAqL1xyXG4gIHRoaXMuX29uU2Nyb2xsRm4gPSBkZWNvdXBsZShkb2MsICdzY3JvbGwnLCBmdW5jdGlvbigpIHtcclxuICAgIGlmICghc2VsZi5fbW92ZWQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHNjcm9sbFRpbWVvdXQpO1xyXG4gICAgICBzY3JvbGxpbmcgPSB0cnVlO1xyXG4gICAgICBzY3JvbGxUaW1lb3V0ID0gc2V0VGltZW91dChmdW5jdGlvbigpIHtcclxuICAgICAgICBzY3JvbGxpbmcgPSBmYWxzZTtcclxuICAgICAgfSwgMjUwKTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgLyoqXHJcbiAgICogUHJldmVudHMgdG91Y2htb3ZlIGV2ZW50IGlmIHNsaWRlb3V0IGlzIG1vdmluZ1xyXG4gICAqL1xyXG4gIHRoaXMuX3ByZXZlbnRNb3ZlID0gZnVuY3Rpb24oZXZlKSB7XHJcbiAgICBpZiAoc2VsZi5fbW92ZWQpIHtcclxuICAgICAgZXZlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB9XHJcbiAgfTtcclxuXHJcbiAgZG9jLmFkZEV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fcHJldmVudE1vdmUpO1xyXG5cclxuICAvKipcclxuICAgKiBSZXNldHMgdmFsdWVzIG9uIHRvdWNoc3RhcnRcclxuICAgKi9cclxuICB0aGlzLl9yZXNldFRvdWNoRm4gPSBmdW5jdGlvbihldmUpIHtcclxuICAgIGlmICh0eXBlb2YgZXZlLnRvdWNoZXMgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBzZWxmLl9tb3ZlZCA9IGZhbHNlO1xyXG4gICAgc2VsZi5fb3BlbmluZyA9IGZhbHNlO1xyXG4gICAgdmFyIG9mZnNldCA9IGV2ZS50b3VjaGVzWzBdLnBhZ2VYO1xyXG4gICAgc2VsZi5fc3RhcnRPZmZzZXRYID0gb2Zmc2V0O1xyXG4gICAgc2VsZi5fcHJldmVudE9wZW4gPSAoIXNlbGYuX3RvdWNoIHx8ICghc2VsZi5pc09wZW4oKSAmJiBzZWxmLm1lbnUuY2xpZW50V2lkdGggIT09IDApICB8fCAoc2VsZi5fZ3JhYldpZHRoICYmIG9mZnNldCA+IHNlbGYuX2dyYWJXaWR0aCkpO1xyXG4gIH07XHJcblxyXG4gIHRoaXMucGFuZWwuYWRkRXZlbnRMaXN0ZW5lcih0b3VjaC5zdGFydCwgdGhpcy5fcmVzZXRUb3VjaEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXRzIHZhbHVlcyBvbiB0b3VjaGNhbmNlbFxyXG4gICAqL1xyXG4gIHRoaXMuX29uVG91Y2hDYW5jZWxGbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgc2VsZi5fbW92ZWQgPSBmYWxzZTtcclxuICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIoJ3RvdWNoY2FuY2VsJywgdGhpcy5fb25Ub3VjaENhbmNlbEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogVG9nZ2xlcyBzbGlkZW91dCBvbiB0b3VjaGVuZFxyXG4gICAqL1xyXG4gIHRoaXMuX29uVG91Y2hFbmRGbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgaWYgKHNlbGYuX21vdmVkKSB7XHJcbiAgICAgIHNlbGYuZW1pdCgndHJhbnNsYXRlZW5kJyk7XHJcbiAgICAgIChzZWxmLl9vcGVuaW5nICYmIE1hdGguYWJzKHNlbGYuX2N1cnJlbnRPZmZzZXRYKSA+IHNlbGYuX3RvbGVyYW5jZSkgPyBzZWxmLm9wZW4oKSA6IHNlbGYuY2xvc2UoKTtcclxuICAgIH1cclxuICAgIHNlbGYuX21vdmVkID0gZmFsc2U7XHJcbiAgfTtcclxuXHJcbiAgdGhpcy5wYW5lbC5hZGRFdmVudExpc3RlbmVyKHRvdWNoLmVuZCwgdGhpcy5fb25Ub3VjaEVuZEZuKTtcclxuXHJcbiAgLyoqXHJcbiAgICogVHJhbnNsYXRlcyBwYW5lbCBvbiB0b3VjaG1vdmVcclxuICAgKi9cclxuICB0aGlzLl9vblRvdWNoTW92ZUZuID0gZnVuY3Rpb24oZXZlKSB7XHJcblxyXG4gICAgaWYgKHNjcm9sbGluZyB8fCBzZWxmLl9wcmV2ZW50T3BlbiB8fCB0eXBlb2YgZXZlLnRvdWNoZXMgPT09ICd1bmRlZmluZWQnKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgZGlmX3ggPSBldmUudG91Y2hlc1swXS5jbGllbnRYIC0gc2VsZi5fc3RhcnRPZmZzZXRYO1xyXG4gICAgdmFyIHRyYW5zbGF0ZVggPSBzZWxmLl9jdXJyZW50T2Zmc2V0WCA9IGRpZl94O1xyXG5cclxuICAgIGlmIChNYXRoLmFicyh0cmFuc2xhdGVYKSA+IHNlbGYuX3BhZGRpbmcpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChNYXRoLmFicyhkaWZfeCkgPiAyMCkge1xyXG5cclxuICAgICAgc2VsZi5fb3BlbmluZyA9IHRydWU7XHJcblxyXG4gICAgICB2YXIgb3JpZW50ZWRfZGlmX3ggPSBkaWZfeCAqIHNlbGYuX29yaWVudGF0aW9uO1xyXG5cclxuICAgICAgaWYgKHNlbGYuX29wZW5lZCAmJiBvcmllbnRlZF9kaWZfeCA+IDAgfHwgIXNlbGYuX29wZW5lZCAmJiBvcmllbnRlZF9kaWZfeCA8IDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmICghc2VsZi5fbW92ZWQpIHtcclxuICAgICAgICBzZWxmLmVtaXQoJ3RyYW5zbGF0ZXN0YXJ0Jyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChvcmllbnRlZF9kaWZfeCA8PSAwKSB7XHJcbiAgICAgICAgdHJhbnNsYXRlWCA9IGRpZl94ICsgc2VsZi5fcGFkZGluZyAqIHNlbGYuX29yaWVudGF0aW9uO1xyXG4gICAgICAgIHNlbGYuX29wZW5pbmcgPSBmYWxzZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKCFzZWxmLl9tb3ZlZCAmJiBodG1sLmNsYXNzTmFtZS5zZWFyY2goJ3NsaWRlb3V0LW9wZW4nKSA9PT0gLTEpIHtcclxuICAgICAgICBodG1sLmNsYXNzTmFtZSArPSAnIHNsaWRlb3V0LW9wZW4nO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBzZWxmLnBhbmVsLnN0eWxlW3ByZWZpeCArICd0cmFuc2Zvcm0nXSA9IHNlbGYucGFuZWwuc3R5bGUudHJhbnNmb3JtID0gJ3RyYW5zbGF0ZVgoJyArIHRyYW5zbGF0ZVggKyAncHgpJztcclxuICAgICAgc2VsZi5lbWl0KCd0cmFuc2xhdGUnLCB0cmFuc2xhdGVYKTtcclxuICAgICAgc2VsZi5fbW92ZWQgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICB9O1xyXG5cclxuICB0aGlzLnBhbmVsLmFkZEV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fb25Ub3VjaE1vdmVGbik7XHJcblxyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEVuYWJsZSBvcGVuaW5nIHRoZSBzbGlkZW91dCB2aWEgdG91Y2ggZXZlbnRzLlxyXG4gKi9cclxuU2xpZGVvdXQucHJvdG90eXBlLmVuYWJsZVRvdWNoID0gZnVuY3Rpb24oKSB7XHJcbiAgdGhpcy5fdG91Y2ggPSB0cnVlO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERpc2FibGUgb3BlbmluZyB0aGUgc2xpZGVvdXQgdmlhIHRvdWNoIGV2ZW50cy5cclxuICovXHJcblNsaWRlb3V0LnByb3RvdHlwZS5kaXNhYmxlVG91Y2ggPSBmdW5jdGlvbigpIHtcclxuICB0aGlzLl90b3VjaCA9IGZhbHNlO1xyXG4gIHJldHVybiB0aGlzO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIERlc3Ryb3kgYW4gaW5zdGFuY2Ugb2Ygc2xpZGVvdXQuXHJcbiAqL1xyXG5TbGlkZW91dC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xyXG4gIC8vIENsb3NlIGJlZm9yZSBjbGVhblxyXG4gIHRoaXMuY2xvc2UoKTtcclxuXHJcbiAgLy8gUmVtb3ZlIGV2ZW50IGxpc3RlbmVyc1xyXG4gIGRvYy5yZW1vdmVFdmVudExpc3RlbmVyKHRvdWNoLm1vdmUsIHRoaXMuX3ByZXZlbnRNb3ZlKTtcclxuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2guc3RhcnQsIHRoaXMuX3Jlc2V0VG91Y2hGbik7XHJcbiAgdGhpcy5wYW5lbC5yZW1vdmVFdmVudExpc3RlbmVyKCd0b3VjaGNhbmNlbCcsIHRoaXMuX29uVG91Y2hDYW5jZWxGbik7XHJcbiAgdGhpcy5wYW5lbC5yZW1vdmVFdmVudExpc3RlbmVyKHRvdWNoLmVuZCwgdGhpcy5fb25Ub3VjaEVuZEZuKTtcclxuICB0aGlzLnBhbmVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodG91Y2gubW92ZSwgdGhpcy5fb25Ub3VjaE1vdmVGbik7XHJcbiAgZG9jLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIHRoaXMuX29uU2Nyb2xsRm4pO1xyXG5cclxuICAvLyBSZW1vdmUgbWV0aG9kc1xyXG4gIHRoaXMub3BlbiA9IHRoaXMuY2xvc2UgPSBmdW5jdGlvbigpIHt9O1xyXG5cclxuICAvLyBSZXR1cm4gdGhlIGluc3RhbmNlIHNvIGl0IGNhbiBiZSBlYXNpbHkgZGVyZWZlcmVuY2VkXHJcbiAgcmV0dXJuIHRoaXM7XHJcbn07XHJcblxyXG4vKipcclxuICogRXhwb3NlIFNsaWRlb3V0XHJcbiAqL1xyXG5tb2R1bGUuZXhwb3J0cyA9IFNsaWRlb3V0O1xyXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByZXF1ZXN0QW5pbUZyYW1lID0gKGZ1bmN0aW9uKCkge1xuICByZXR1cm4gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZSB8fFxuICAgIHdpbmRvdy53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHxcbiAgICBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xuICAgIH07XG59KCkpO1xuXG5mdW5jdGlvbiBkZWNvdXBsZShub2RlLCBldmVudCwgZm4pIHtcbiAgdmFyIGV2ZSxcbiAgICAgIHRyYWNraW5nID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gY2FwdHVyZUV2ZW50KGUpIHtcbiAgICBldmUgPSBlO1xuICAgIHRyYWNrKCk7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFjaygpIHtcbiAgICBpZiAoIXRyYWNraW5nKSB7XG4gICAgICByZXF1ZXN0QW5pbUZyYW1lKHVwZGF0ZSk7XG4gICAgICB0cmFja2luZyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlKCkge1xuICAgIGZuLmNhbGwobm9kZSwgZXZlKTtcbiAgICB0cmFja2luZyA9IGZhbHNlO1xuICB9XG5cbiAgbm9kZS5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCBjYXB0dXJlRXZlbnQsIGZhbHNlKTtcblxuICByZXR1cm4gY2FwdHVyZUV2ZW50O1xufVxuXG4vKipcbiAqIEV4cG9zZSBkZWNvdXBsZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGRlY291cGxlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgX2NsYXNzQ2FsbENoZWNrID0gZnVuY3Rpb24gKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uXCIpOyB9IH07XHJcblxyXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xyXG4vKipcclxuICogQ3JlYXRlcyBhIG5ldyBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gKiBAY2xhc3NcclxuICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhIG5ldyBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gKiBAZXhhbXBsZVxyXG4gKiAvLyBDcmVhdGVzIGEgbmV3IGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAqIHZhciBFbWl0dGVyID0gcmVxdWlyZSgnZW1pdHRlcicpO1xyXG4gKlxyXG4gKiB2YXIgZW1pdHRlciA9IG5ldyBFbWl0dGVyKCk7XHJcbiAqL1xyXG5cclxudmFyIEVtaXR0ZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gIGZ1bmN0aW9uIEVtaXR0ZXIoKSB7XHJcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRW1pdHRlcik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdG8gdGhlIGNvbGxlY3Rpb24gZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gQSBsaXN0ZW5lciBmdW5jdGlvbiB0byBhZGQuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gQWRkIGFuIGV2ZW50IGxpc3RlbmVyIHRvIFwiZm9vXCIgZXZlbnQuXHJcbiAgICogZW1pdHRlci5vbignZm9vJywgbGlzdGVuZXIpO1xyXG4gICAqL1xyXG5cclxuICBFbWl0dGVyLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uIG9uKGV2ZW50LCBsaXN0ZW5lcikge1xyXG4gICAgLy8gVXNlIHRoZSBjdXJyZW50IGNvbGxlY3Rpb24gb3IgY3JlYXRlIGl0LlxyXG4gICAgdGhpcy5fZXZlbnRDb2xsZWN0aW9uID0gdGhpcy5fZXZlbnRDb2xsZWN0aW9uIHx8IHt9O1xyXG5cclxuICAgIC8vIFVzZSB0aGUgY3VycmVudCBjb2xsZWN0aW9uIG9mIGFuIGV2ZW50IG9yIGNyZWF0ZSBpdC5cclxuICAgIHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0gPSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdIHx8IFtdO1xyXG5cclxuICAgIC8vIEFwcGVuZHMgdGhlIGxpc3RlbmVyIGludG8gdGhlIGNvbGxlY3Rpb24gb2YgdGhlIGdpdmVuIGV2ZW50XHJcbiAgICB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdLnB1c2gobGlzdGVuZXIpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYSBsaXN0ZW5lciB0byB0aGUgY29sbGVjdGlvbiBmb3IgdGhlIHNwZWNpZmllZCBldmVudCB0aGF0IHdpbGwgYmUgY2FsbGVkIG9ubHkgb25jZS5cclxuICAgKiBAbWVtYmVyb2YhIEVtaXR0ZXIucHJvdG90eXBlXHJcbiAgICogQGZ1bmN0aW9uXHJcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50IC0gVGhlIGV2ZW50IG5hbWUuXHJcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbGlzdGVuZXIgLSBBIGxpc3RlbmVyIGZ1bmN0aW9uIHRvIGFkZC5cclxuICAgKiBAcmV0dXJucyB7T2JqZWN0fSBSZXR1cm5zIGFuIGluc3RhbmNlIG9mIEVtaXR0ZXIuXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBXaWxsIGFkZCBhbiBldmVudCBoYW5kbGVyIHRvIFwiZm9vXCIgZXZlbnQgb25jZS5cclxuICAgKiBlbWl0dGVyLm9uY2UoJ2ZvbycsIGxpc3RlbmVyKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIG9uY2UoZXZlbnQsIGxpc3RlbmVyKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gZm4oKSB7XHJcbiAgICAgIHNlbGYub2ZmKGV2ZW50LCBmbik7XHJcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm4ubGlzdGVuZXIgPSBsaXN0ZW5lcjtcclxuXHJcbiAgICB0aGlzLm9uKGV2ZW50LCBmbik7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlcyBhIGxpc3RlbmVyIGZyb20gdGhlIGNvbGxlY3Rpb24gZm9yIHRoZSBzcGVjaWZpZWQgZXZlbnQuXHJcbiAgICogQG1lbWJlcm9mISBFbWl0dGVyLnByb3RvdHlwZVxyXG4gICAqIEBmdW5jdGlvblxyXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBldmVudCAtIFRoZSBldmVudCBuYW1lLlxyXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGxpc3RlbmVyIC0gQSBsaXN0ZW5lciBmdW5jdGlvbiB0byByZW1vdmUuXHJcbiAgICogQHJldHVybnMge09iamVjdH0gUmV0dXJucyBhbiBpbnN0YW5jZSBvZiBFbWl0dGVyLlxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gUmVtb3ZlIGEgZ2l2ZW4gbGlzdGVuZXIuXHJcbiAgICogZW1pdHRlci5vZmYoJ2ZvbycsIGxpc3RlbmVyKTtcclxuICAgKi9cclxuXHJcbiAgRW1pdHRlci5wcm90b3R5cGUub2ZmID0gZnVuY3Rpb24gb2ZmKGV2ZW50LCBsaXN0ZW5lcikge1xyXG5cclxuICAgIHZhciBsaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XHJcblxyXG4gICAgLy8gRGVmaW5lcyBsaXN0ZW5lcnMgdmFsdWUuXHJcbiAgICBpZiAoIXRoaXMuX2V2ZW50Q29sbGVjdGlvbiB8fCAhKGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50Q29sbGVjdGlvbltldmVudF0pKSB7XHJcbiAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG5cclxuICAgIGxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChmbiwgaSkge1xyXG4gICAgICBpZiAoZm4gPT09IGxpc3RlbmVyIHx8IGZuLmxpc3RlbmVyID09PSBsaXN0ZW5lcikge1xyXG4gICAgICAgIC8vIFJlbW92ZXMgdGhlIGdpdmVuIGxpc3RlbmVyLlxyXG4gICAgICAgIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFJlbW92ZXMgYW4gZW1wdHkgZXZlbnQgY29sbGVjdGlvbi5cclxuICAgIGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIEV4ZWN1dGUgZWFjaCBpdGVtIGluIHRoZSBsaXN0ZW5lciBjb2xsZWN0aW9uIGluIG9yZGVyIHdpdGggdGhlIHNwZWNpZmllZCBkYXRhLlxyXG4gICAqIEBtZW1iZXJvZiEgRW1pdHRlci5wcm90b3R5cGVcclxuICAgKiBAZnVuY3Rpb25cclxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnQgLSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgeW91IHdhbnQgdG8gZW1pdC5cclxuICAgKiBAcGFyYW0gey4uLk9iamVjdH0gZGF0YSAtIERhdGEgdG8gcGFzcyB0byB0aGUgbGlzdGVuZXJzLlxyXG4gICAqIEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgYW4gaW5zdGFuY2Ugb2YgRW1pdHRlci5cclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIEVtaXRzIHRoZSBcImZvb1wiIGV2ZW50IHdpdGggJ3BhcmFtMScgYW5kICdwYXJhbTInIGFzIGFyZ3VtZW50cy5cclxuICAgKiBlbWl0dGVyLmVtaXQoJ2ZvbycsICdwYXJhbTEnLCAncGFyYW0yJyk7XHJcbiAgICovXHJcblxyXG4gIEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KGV2ZW50KSB7XHJcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xyXG5cclxuICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xyXG4gICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgbGlzdGVuZXJzID0gdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIERlZmluZXMgbGlzdGVuZXJzIHZhbHVlLlxyXG4gICAgaWYgKCF0aGlzLl9ldmVudENvbGxlY3Rpb24gfHwgIShsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudENvbGxlY3Rpb25bZXZlbnRdKSkge1xyXG4gICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICAvLyBDbG9uZSBsaXN0ZW5lcnNcclxuICAgIGxpc3RlbmVycyA9IGxpc3RlbmVycy5zbGljZSgwKTtcclxuXHJcbiAgICBsaXN0ZW5lcnMuZm9yRWFjaChmdW5jdGlvbiAoZm4pIHtcclxuICAgICAgcmV0dXJuIGZuLmFwcGx5KF90aGlzLCBhcmdzKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH07XHJcblxyXG4gIHJldHVybiBFbWl0dGVyO1xyXG59KSgpO1xyXG5cclxuLyoqXHJcbiAqIEV4cG9ydHMgRW1pdHRlclxyXG4gKi9cclxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBFbWl0dGVyO1xyXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbXCJkZWZhdWx0XCJdOyJdfQ==
