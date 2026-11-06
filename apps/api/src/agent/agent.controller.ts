import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { EventType, type BaseEvent, type RunAgentInput } from '@ag-ui/core';
import { EventEncoder } from '@ag-ui/encoder';
import { AgentService } from './agent.service.js';

@Controller()
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  /** AG-UI endpoint: receives RunAgentInput, streams AG-UI events over SSE. */
  @Post('agui')
  async run(@Body() input: RunAgentInput, @Res() res: Response): Promise<void> {
    const encoder = new EventEncoder();
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const emit = (event: BaseEvent) => {
      if (!res.writableEnded && !abort.signal.aborted) res.write(encoder.encodeSSE(event));
    };

    try {
      await this.agent.run(input ?? ({} as RunAgentInput), emit, abort.signal);
    } catch (e) {
      emit({
        type: EventType.RUN_ERROR,
        message: e instanceof Error ? e.message : String(e),
      } as BaseEvent);
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}
