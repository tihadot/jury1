import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Set the timeout limit in milliseconds
    const executionTimeout = parseInt(process.env.EXECUTION_TIME_LIMIT) || 10000;

    return next.handle().pipe(
      timeout(executionTimeout),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException('The execution exceeded the allowed time limit.');
        }
        throw err;
      }),
    );
  }
}
