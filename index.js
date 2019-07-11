class PromiseEventEmitter {
  constructor() {
    this._listeners = Object.create(null);
    this._maxListeners = PromiseEventEmitter.defaultMaxListeners;
  }

  /**
   * Listen to event
   * 
   * @param {String} eventName
   * @param {Function} listener
   * @returns {PromiseEventEmitter} for chaining
   */
  on(eventName, listener) {
    this._addListener(eventName, listener, false, false, null, null, null);
    return this;
  }

  off(eventName, listener) {
    this.removeListener(eventName, listener);
    return this;
  }

  once(eventName, listener) {
    this._addListener(eventName, listener, true, false, null, null, null);
    return this;
  }

  after(eventName, target, listener) {
    this._addListener(eventName, listener, false, false, target, null, null);
  }

  before(eventName, target, listener) {
    this._addListener(eventName, listener, false, false, null, target, null);
  }

  afterOnce(eventName, target, listener) {
    this._addListener(eventName, listener, true, false, target, null, null);
  }

  beforeOnce(eventName, target, listener) {
    this._addListener(eventName, listener, true, false, null, target, null);
  }

  prependListener(eventName, listener) {
    this._addListener(eventName, listener, false, true, null, null, null);
  }

  prependOnceListener(eventName, listener) {
    this._addListener(eventName, listener, true, true, null, null, null);
  }

  _addListener(eventName, listener, once, prepend, after, before, at) {
    this._verifyListenerType(listener);

    if (!Array.isArray(this._listeners[eventName])) {
      this._listeners[eventName] = [];
    }

    /*
     * the  listeners of 'listener-error' are not wrapped
     * because errors thrown by these listeners should not be
     * catched. If 'listener-error's listener throws error
     * next listener will not be called.
     */
    const wrappedListener = eventName === 'listener-error'
      ? this._wrapErrorListener(listener, once)
      : this._wrapListener(listener, once);

    wrappedListener.listener = listener;

    let addAt = null;
    if (prepend) {
      addAt = 0;
    } else if (at !== null && at !== undefined) {
      addAt = at;
    } else if (after || before) {
      addAt = this._listeners[eventName]
        .findIndex(wrpFn => wrpFn.listener === after || wrpFn.listener === before);
      if (addAt === -1) {
        addAt = this._listeners[eventName].length;
      } else if (after) {
        addAt += 1;
      }
    } else {
      addAt = this._listeners[eventName].length;
    }

    this._listeners[eventName].splice(addAt, 0, wrappedListener);

    const listenerCount = this.listenerCount(eventName);
    if (listenerCount > this.getMaxListeners()) {
      console.warn('MaxListenersExceededWarning: Possible EventEmitter '
      + `memory leak detected. ${listenerCount} 1 listeners added. Use `
      + 'emitter.setMaxListeners() to increase limit');
    }
  }

  listenerCount(eventName) {
    if (Array.isArray(this._listeners[eventName])) {
      return this._listeners[eventName].length;
    }
    return 0;
  }

  /**
   * If listener function throws error
   * wrapped function will catch it and fire 'listener-error'
   * event. But if no listener was attached to event 'listener-error'
   * the error will be thrown and next listener will not be called.
   *
   * @param {Function} listener
   * @returns {Function}
   */
  _wrapListener(listener, once) {
    const ctx = {
      listener,
      once,
      fired: false,
      target: this,
    };
    return (async function (...args) {
      if (this.once && this.fired) {
        return;
      }
      try {
        this.fired = true;
        return this.listener.call(this.target, ...args);
      } catch (error) {
        if (this.target.listenerCount('listener-error') > 0) {
          await this.target.emit('listener-error', error);
        } else {
          throw error;
        }
      }
    }).bind(ctx);
  }

  _wrapErrorListener(listener, once) {
    const ctx = {
      listener,
      once,
      fired: false,
      target: this,
    };
    return (async function (...args) {
      if (this.once && this.fired) {
        return;
      }
      this.fired = true;
      return this.listener.call(this.target, ...args);
    }).bind(ctx);
  }

  _verifyListenerType(listener) {
    if (typeof listener !== 'function') {
      const typeError = new TypeError(`The "listener" argument must be of type Function. Received type ${typeof listener}`);
      typeError.code = 'ERR_INVALID_ARG_TYPE';
      throw typeError;
    }
  }

  async emit(eventName, ...args) {
    const listenerCount = this.listenerCount(eventName);
    if (listenerCount > 0) {
      for (let i = 0; i < listenerCount; i++) {
        await this._listeners[eventName][i](...args);
      }
    }
  }

  removeAllListeners(eventName) {
    if (arguments.length === 0) {
      this._listeners = {};
    } else if (this.listenerCount(eventName) !== 0) {
      this._listeners[eventName] = [];
    }
    return this;
  }

  removeListener(eventName, listener) {
    if (this.listenerCount(eventName) !== 0) {
      for (let i = 0; i < this._listeners[eventName].length; i++) {
        if (listener === this._listeners[eventName].listener) {
          this._listeners[eventName].splice(i, 1);
          break;
        }
      }
    }
    return this;
  }

  eventNames() {
    return Object.keys(this._listeners);
  }

  rawListeners(eventName) {
    if (!Array.isArray(this._listeners[eventName])) {
      return [];
    }
    const raw = [];
    for (let i = 0; i < this._listeners[eventName].length; i++) {
      if (this._listeners[eventName].once) {
        raw.push(this._listeners[eventName]);
      } else {
        raw.push(this._listeners[eventName].listener);
      }
    }
    return raw;
  }

  setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || Number.isNaN(n)) {
      const rangeError = new RangeError(`The value of "n" is out of range. It must be a non-negative number. Received ${n}`);
      rangeError.code = 'ERR_OUT_OF_RANGE';
      throw rangeError;
    }
    this._maxListeners = n;
  }

  getMaxListeners() {
    if (this._maxListeners === undefined) {
      return PromiseEventEmitter.defaultMaxListeners;
    }
    return this._maxListeners;
  }
}

PromiseEventEmitter.listenerCount = function listenerCount(emitter, eventName) {
  emitter.listenerCount(eventName);
};

PromiseEventEmitter.defaultMaxListeners = 10;

module.exports = PromiseEventEmitter;
