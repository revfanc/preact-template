import { protect, readMarker, type Marker } from './history';
import { deferred, failure, type Completion } from './transaction';
import type { BackHandler, RegisterOptions, Unregister } from './types';

interface Registration {
  handler: BackHandler;
  options: RegisterOptions;
  active: boolean;
  cleanup?: Promise<void>;
}
interface Attempt {
  owner: Registration;
  valid: boolean;
  callbackFinished: boolean;
  done?: Completion;
}
interface Movement {
  target: Marker['kind'];
  completion: Completion;
  timer: ReturnType<typeof setTimeout>;
}

/** One live page, one pair, one outstanding native traversal. */
export class Scope {
  private marker = protect();
  private position = this.marker.kind;
  private stack: Registration[] = [];
  private attempt?: Attempt;
  private movement?: Movement;
  private reported = new Set<unknown>();
  private disposing = false;
  closed = false;

  constructor() {
    window.addEventListener('popstate', this.onPop);
    window.addEventListener('pagehide', this.onHide);
  }

  ownsCurrent() {
    const current = readMarker();
    return (
      !this.closed &&
      current?.pair === this.marker.pair &&
      current.url === this.marker.url
    );
  }

  add(handler: BackHandler, options: RegisterOptions): Unregister {
    if (this.disposing)
      throw new Error(
        'Wait for the last unregister() before registering again.',
      );
    this.invalidateAttempt();
    // Re-establish protection if the current owned entry is at base.
    if (!this.movement && readMarker()?.kind === 'base') {
      this.marker = protect();
      this.position = 'guard';
    }
    const entry: Registration = { handler, options, active: true };
    this.stack.push(entry);
    return () => {
      if (entry.cleanup) return entry.cleanup;
      entry.cleanup = this.remove(entry);
      this.observe(entry.cleanup, entry);
      return entry.cleanup;
    };
  }

  private top() {
    return this.stack[this.stack.length - 1];
  }

  private report(error: unknown, owner?: Registration) {
    if (this.reported.has(error)) return;
    this.reported.add(error);
    try {
      if (owner?.options.onError) owner.options.onError(error);
      else console.error(error);
    } catch (reportError) {
      console.error(reportError);
    }
  }

  private observe(promise: Promise<void>, owner?: Registration) {
    // Observe even ignored calls, while preserving the original rejecting Promise for awaiters.
    void promise.catch((error: unknown) => this.report(error, owner));
    return promise;
  }

  private invalidateAttempt() {
    const attempt = this.attempt;
    if (!attempt) return;
    attempt.valid = false;
    attempt.done?.reject(
      failure('AbortError', 'This Back callback is no longer current.'),
    );
    this.finishAttempt();
  }

  private finishAttempt() {
    const attempt = this.attempt;
    if (!attempt || this.movement) return;
    if (
      !attempt.valid ||
      attempt.done?.settled ||
      (attempt.callbackFinished && !attempt.done)
    ) {
      this.attempt = undefined;
    }
  }

  private isValid(attempt: Attempt) {
    return (
      this.attempt === attempt &&
      attempt.valid &&
      attempt.owner.active &&
      this.top() === attempt.owner &&
      this.ownsCurrent() &&
      !this.disposing
    );
  }

  private done(attempt: Attempt): Promise<void> {
    if (attempt.done) return attempt.done.promise;
    const completion = deferred();
    attempt.done = completion;
    this.observe(completion.promise, attempt.owner);
    const check = () => {
      if (!this.isValid(attempt))
        throw failure('AbortError', 'This done() has expired.');
    };
    try {
      check();
      void this.moveTo('guard')
        .then(() => {
          check();
          // Commit completion only after restoration: consume this registration,
          // and let final cleanup release the pair when no lower layer remains.
          this.attempt = undefined;
          attempt.owner.cleanup = completion.promise;
          return this.remove(attempt.owner);
        })
        .then(() => {
          completion.resolve();
          this.finishAttempt();
        })
        .catch((error: unknown) => {
          completion.reject(error);
          this.finishAttempt();
        });
    } catch (error) {
      completion.reject(error);
    }
    return completion.promise;
  }

  private invoke(owner: Registration) {
    const attempt: Attempt = { owner, valid: true, callbackFinished: false };
    this.attempt = attempt;
    const restored = this.moveTo('guard');
    this.observe(restored, owner);
    if (this.closed) return;
    const finish = () => {
      attempt.callbackFinished = true;
      if (!attempt.done) attempt.valid = false;
      this.finishAttempt();
    };
    const failed = (error: unknown) => {
      this.report(error, owner);
      if (this.attempt === attempt && !attempt.done?.settled)
        this.invalidateAttempt();
      finish();
    };
    try {
      const result = owner.handler(() => this.done(attempt));
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).then(finish, failed);
      } else finish();
    } catch (error) {
      failed(error);
    }
  }

  private moveTo(target: Marker['kind']): Promise<void> {
    if (!this.ownsCurrent()) {
      const error = failure(
        'AbortError',
        'The protected history entry changed.',
      );
      this.stop(error);
      return Promise.reject(error);
    }
    if (this.movement) {
      const movement = this.movement;
      return movement.target === target
        ? movement.completion.promise
        : movement.completion.promise.then(() => this.moveTo(target));
    }
    if (readMarker()!.kind === target) return Promise.resolve();
    const completion = deferred();
    const timer = setTimeout(() => {
      this.stop(
        failure(
          'TimeoutError',
          'History traversal was not confirmed within 2000ms.',
        ),
      );
    }, 2000);
    this.movement = { target, completion, timer };
    try {
      history.go(target === 'guard' ? 1 : -1);
    } catch (error) {
      this.stop(error);
    }
    return completion.promise;
  }

  private onPop = () => {
    if (!this.ownsCurrent()) {
      const error = failure('AbortError', 'History left the protected pair.');
      if (this.attempt) this.report(error, this.attempt.owner);
      this.stop(error);
      return;
    }
    const previous = this.position;
    this.position = readMarker()!.kind;
    const movement = this.movement;
    if (movement) {
      if (this.position === movement.target) {
        clearTimeout(movement.timer);
        this.movement = undefined;
        movement.completion.resolve();
        this.finishAttempt();
      }
      return;
    }
    if (previous !== 'guard' || this.position !== 'base' || this.disposing)
      return;
    const owner = this.top();
    if (!owner) return;
    if (this.attempt) this.observe(this.moveTo('guard'), this.attempt.owner);
    else this.invoke(owner);
  };

  private remove(entry: Registration): Promise<void> {
    if (!entry.active || this.closed) return Promise.resolve();
    entry.active = false;
    this.stack.splice(this.stack.indexOf(entry), 1);
    if (this.attempt?.owner === entry) this.invalidateAttempt();
    if (this.stack.length) return Promise.resolve();
    this.disposing = true;
    if (!this.ownsCurrent()) {
      this.stop();
      return Promise.resolve();
    }
    return this.moveTo('base').then(
      () => this.stop(),
      (error: unknown) => {
        this.stop(error);
        throw error;
      },
    );
  }

  private onHide = () =>
    this.stop(failure('AbortError', 'The page was hidden or left.'));

  stop(
    error: unknown = failure(
      'AbortError',
      'The registration is no longer active.',
    ),
  ) {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('popstate', this.onPop);
    window.removeEventListener('pagehide', this.onHide);
    const movement = this.movement;
    this.movement = undefined;
    if (movement) {
      clearTimeout(movement.timer);
      movement.completion.reject(error);
    }
    if (this.attempt) {
      this.attempt.valid = false;
      this.attempt.done?.reject(error);
      this.attempt = undefined;
    }
    this.stack.forEach((entry) => {
      entry.active = false;
    });
    this.stack = [];
  }
}
