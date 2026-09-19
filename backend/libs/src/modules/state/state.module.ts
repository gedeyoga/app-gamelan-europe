import { Module } from '@nestjs/common';
import { StateRepository } from './state.repository';
import { StateService } from './state.service';

@Module({
  providers: [StateRepository, StateService],
  exports: [StateRepository, StateService],
})
export class StateModule {}
