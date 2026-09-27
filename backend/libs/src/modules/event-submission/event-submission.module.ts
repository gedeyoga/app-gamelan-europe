import { Module } from '@nestjs/common';
import { CountryModule } from '@app/libs/modules/country/country.module';
import { StateModule } from '@app/libs/modules/state/state.module';
import { EventModule } from '@app/libs/modules/event/event.module';
import { EventTypeModule } from '@app/libs/modules/event-type/event-type.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { OrganizationModule } from '@app/libs/modules/organization/organization.module';
import { EventSubmissionRepository } from './event-submission.repository';
import { EventSubmissionService } from './event-submission.service';

@Module({
  imports: [CountryModule, StateModule, EventModule, EventTypeModule, ImageModule, OrganizationModule],
  providers: [EventSubmissionRepository, EventSubmissionService],
  exports: [EventSubmissionRepository, EventSubmissionService],
})
export class EventSubmissionModule {}
