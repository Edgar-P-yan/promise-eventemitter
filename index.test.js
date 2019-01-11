/* global describe, it, before, beforeEach */
/* eslint-disable no-unused-expressions */
const chai = require('chai');
const PromiseEventEmitter = require('./index');

chai.should();

describe('PromiseEventEmitter', () => {
  let promiseEventEmitter;
  beforeEach(() => {
    promiseEventEmitter = new PromiseEventEmitter();
  });
  describe('#_verifyListenerType', function () {
    it('should throw TypeError with code \'ERR_INVALID_ARG_TYPE\' when the only argument is not of type function.', function () {
      try {
        promiseEventEmitter._verifyListenerType(null);
        throw Error();
      } catch (err) {
        err.should.be.instanceOf(TypeError);
        err.should.have.ownProperty('code', 'ERR_INVALID_ARG_TYPE');
      }
    });

    it('finishes without throwing error when the only argument is function.', function () {
      promiseEventEmitter._verifyListenerType(() => {});
    });
  });

  describe('#on', function () {
    it('should throw TypeError with code \'ERR_INVALID_ARG_TYPE\' when listener argument is not of type function.', function () {
      try {
        promiseEventEmitter.on('event-1', 0);
        throw Error();
      } catch (err) {
        err.should.be.instanceOf(TypeError);
        err.should.have.ownProperty('code', 'ERR_INVALID_ARG_TYPE');
      }
    });

    it('should accept event names of any type.', function () {
      promiseEventEmitter.on('event-2', () => {});
      promiseEventEmitter.on(null, () => {});
      promiseEventEmitter.on(undefined, () => {});
      promiseEventEmitter.on({}, () => {});
      promiseEventEmitter.on(() => {}, () => {});
    });
  });

  describe('#_addListener', function () {
    it('should accept event names of any type.', function () {
      promiseEventEmitter._addListener('event-2', () => {}, false, false, null, null, null);
      promiseEventEmitter._addListener(null, () => {}, false, false, null, null, null);
      promiseEventEmitter._addListener(undefined, () => {}, false, false, null, null, null);
      promiseEventEmitter._addListener({}, () => {}, false, false, null, null, null);
      promiseEventEmitter._addListener(() => {}, () => {}, false, false, null, null, null);
    });
  });

  describe('#listenerCount', function () {
    it('should return 0 if the event never have been listened.', function () {
      promiseEventEmitter.listenerCount('event-that-was-never-listened').should.be.equal(0);
    });

    it('should return listeners count for event.', function () {
      const listenerCounts = [
        { eventName: 'event-1', listenerCount: 5 },
        { eventName: 'event-2', listenerCount: 1 },
        { eventName: 'event-3', listenerCount: 0 },
      ];

      listenerCounts.forEach((lsCount) => {
        for (let i = 0; i < lsCount.listenerCount; i++) {
          promiseEventEmitter.on(lsCount.eventName, () => {});
        }
      });
      listenerCounts.forEach((lsCount) => {
        promiseEventEmitter.listenerCount(lsCount.eventName).should.be.equal(lsCount.listenerCount);
      });
    });
  });

  describe('#emit', function () {
    it('should call all attached listeners.', async function () {
      const callLog = [false, false, false];
      promiseEventEmitter.on('event-1', () => {
        callLog[0] = true;
      });
      promiseEventEmitter.on('event-1', () => {
        callLog[1] = true;
      });
      promiseEventEmitter.on('event-1', () => {
        callLog[2] = true;
      });

      await promiseEventEmitter.emit('event-1');

      callLog.forEach((log) => {
        log.should.be.true;
      });
    });

    it('should call listener function with given arguments.', async function () {
      let args = [null, null];
      promiseEventEmitter.on('event-2', (num1, num2) => {
        args = [num1, num2];
      });
      await promiseEventEmitter.emit('event-2', 1, 2);

      args.should.be.deep.equal([1, 2]);
    });

    it('should stop event propogation if listener throws error.', async function () {
      const callLog = [];
      promiseEventEmitter.on('event-3', () => {
        callLog.push(1);
      });
      promiseEventEmitter.on('event-3', () => {
        callLog.push(2);
      });
      promiseEventEmitter.on('event-3', () => {
        throw new Error('Some error');
      });
      promiseEventEmitter.on('event-3', () => {
        callLog.push(3);
      });
      try {
        await promiseEventEmitter.emit('event-3');
      } catch (error) {
        callLog.should.be.deep.equal([1, 2]);
      }
    });
  });

  describe('#_wrapListener', function () {
    it('should call listener functions in the emitter\'s context.', async function () {
      let calledWithTheEmittersContext = false;
      promiseEventEmitter.on('event-1', function () {
        calledWithTheEmittersContext = this === promiseEventEmitter;
      });

      await promiseEventEmitter.emit('event-1');
      calledWithTheEmittersContext.should.be.true;
    });

    it('should fire \'listener-error\' event, if it have listeners, with an error as an argument, thrown by listener function of other event.', async function () {
      let listenerErrorEventFired = false;
      const errorToThrow = new Error('Some error.');
      let errorThatWasThrown;
      promiseEventEmitter.on('listener-error', (error) => {
        listenerErrorEventFired = true;
        errorThatWasThrown = error;
      });
      promiseEventEmitter.on('event-4', () => {
        throw errorToThrow;
      });
      await promiseEventEmitter.emit('event-4');
      listenerErrorEventFired.should.be.true;
      errorToThrow.should.be.equal(errorThatWasThrown);
    });

    it('should throw error thrown by listener function if \'listener-error\' event have no listeners.', async function () {
      promiseEventEmitter._listeners = []; // clearing all events and listeners
      const errorToThrow = new Error('Some error');
      promiseEventEmitter.on('event-2', function () {
        throw errorToThrow;
      });

      try {
        await promiseEventEmitter.emit('event-2');
      } catch (err) {
        err.should.be.equal(errorToThrow);
      }
    });

    it('should work multiple times when the once flag is not used.', async function () {
      const callLog = [];
      const wrapped = promiseEventEmitter._wrapListener(() => {
        callLog.push(1);
      }, false);
      wrapped();
      wrapped();
      callLog.should.have.lengthOf(2);
    });

    it('should work only once when once flag is used.', function () {
      const callLog = [];
      const wrapped = promiseEventEmitter._wrapListener(() => {
        callLog.push(1);
      }, true);
      wrapped();
      wrapped();
      callLog.should.have.lengthOf(1);
    });
  });

  describe('#_wrapErrorListener', function () {
    it('error event listener function wrap should throw error thrown by nested function.', async function () {
      const errorToThrow = Error('Some error');
      const wrapped = promiseEventEmitter._wrapErrorListener(() => {
        throw errorToThrow;
      });
      try {
        await wrapped();
      } catch (err) {
        err.should.be.equal(errorToThrow);
      }
    });

    it('should work multiple times when the once flag is not used.', async function () {
      const callLog = [];
      const wrapped = promiseEventEmitter._wrapErrorListener(() => {
        callLog.push(1);
      }, false);
      wrapped();
      wrapped();
      callLog.should.have.lengthOf(2);
    });

    it('should work only once when once flag is used.', function () {
      const callLog = [];
      const wrapped = promiseEventEmitter._wrapErrorListener(() => {
        callLog.push(1);
      }, true);
      wrapped();
      wrapped();
      callLog.should.have.lengthOf(1);
    });
  });

  describe('#once', function () {
    it('should work only once when once flag is used.', async function () {
      const callLog = [];
      promiseEventEmitter.once('event', () => {
        callLog.push(1);
      });
      await promiseEventEmitter.emit('event');
      await promiseEventEmitter.emit('event');

      callLog.should.have.lengthOf(1);
    });
  });

  describe('#prependListener', function () {
    it('should call listener function before all other listeners regardless of listening order.', async function () {
      const callLog = [];

      promiseEventEmitter.on('event', () => {
        callLog.push('works last');
      });

      promiseEventEmitter.prependListener('event', () => {
        callLog.push('going to work first');
      });

      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal(['going to work first', 'works last']);
    });

    it('will fire on every event.', async function () {
      const callLog = [];
      promiseEventEmitter.prependListener('event-2', () => {
        callLog.push(1);
      });
      await promiseEventEmitter.emit('event-2');
      await promiseEventEmitter.emit('event-2');
      callLog.should.have.lengthOf(2);
    });
  });

  describe('#prependOnceListener', function () {
    it('should call listener function before all other listeners regardless of listening order.', async function () {
      const callLog = [];

      promiseEventEmitter.on('event', () => {
        callLog.push('works last');
      });

      promiseEventEmitter.prependOnceListener('event', () => {
        callLog.push('going to work first');
      });

      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal(['going to work first', 'works last']);
    });

    it('should fire only once.', async function () {
      const callLog = [];
      promiseEventEmitter.prependOnceListener('event-2', () => {
        callLog.push(1);
      });
      await promiseEventEmitter.emit('event-2');
      await promiseEventEmitter.emit('event-2');
      callLog.should.have.lengthOf(1);
    });
  });

  describe('#after', function () {
    it('should fire after scpecified listener function', async function () {
      const callLog = [];
      const fn1 = function () {
        callLog.push(1);
      };

      const fn2 = function () {
        callLog.push(2);
      };

      promiseEventEmitter.on('event', fn1);
      promiseEventEmitter.on('event', fn2);
      promiseEventEmitter.after('event', fn1, () => {
        callLog.push('"after" listener');
      });
      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal([1, '"after" listener', 2]);
    });

    it('should fire after all listener functions if target function was not assigned.', async function () {
      const callLog = [];
      const fn1 = function () {
        callLog.push(1);
      };

      const fn2 = function () {
        callLog.push(2);
      };

      const fnThatIsNotListeningToEvent = () => {};

      promiseEventEmitter.on('event', fn1);
      promiseEventEmitter.on('event', fn2);
      promiseEventEmitter.after('event', fnThatIsNotListeningToEvent, () => {
        callLog.push('"after" listener');
      });
      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal([1, 2, '"after" listener']);
    });
  });

  describe('#afterOnce', function () {
    it('should fire after scpecified listener function only once', async function () {
      const callLog = [];
      const fn1 = function () {
        callLog.push(1);
      };

      const fn2 = function () {
        callLog.push(2);
      };

      promiseEventEmitter.on('event', fn1);
      promiseEventEmitter.on('event', fn2);
      promiseEventEmitter.afterOnce('event', fn1, () => {
        callLog.push('"after" listener');
      });
      await promiseEventEmitter.emit('event');
      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal([1, '"after" listener', 2, 1, 2]);
    });

    it('should fire after all listener functions only once if target function was not assigned.', async function () {
      const callLog = [];
      const fn1 = function () {
        callLog.push(1);
      };

      const fn2 = function () {
        callLog.push(2);
      };

      const fnThatIsNotListeningToEvent = () => {};

      promiseEventEmitter.on('event', fn1);
      promiseEventEmitter.on('event', fn2);
      promiseEventEmitter.afterOnce('event', fnThatIsNotListeningToEvent, () => {
        callLog.push('"after" listener');
      });
      await promiseEventEmitter.emit('event');
      await promiseEventEmitter.emit('event');
      callLog.should.be.deep.equal([1, 2, '"after" listener', 1, 2]);
    });
  });
});
