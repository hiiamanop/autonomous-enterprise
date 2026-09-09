import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AUDIT_ACTION_KEY } from './audit.decorators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly reflector: Reflector;

  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Optional() reflector?: Reflector
  ) {
    this.reflector = reflector || new Reflector();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.getAllAndOverride<string>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!action || !this.auditService) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const input = {
      params: req.params,
      query: req.query,
      body: req.body
    };

    return next.handle().pipe(
      tap((output) => {
        // Several services audit the same action themselves with richer detail.
        // Defer to that record rather than emitting a near-identical duplicate,
        // which would otherwise show up twice in the live trace.
        this.auditService.record(
          {
            action,
            input,
            output,
            status: 'SUCCESS'
          },
          { skipIfAlreadyRecorded: true }
        );
      }),
      catchError((error) => {
        this.auditService.record({
          action,
          input,
          status: 'FAILURE',
          reasoning: error.message || 'Execution error'
        });
        return throwError(() => error);
      })
    );
  }
}
