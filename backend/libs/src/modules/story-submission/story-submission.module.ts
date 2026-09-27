import { Module } from '@nestjs/common';
import { CategoryModule } from '@app/libs/modules/category/category.module';
import { ImageModule } from '@app/libs/modules/image/image.module';
import { PostModule } from '@app/libs/modules/post/post.module';
import { StorySubmissionRepository } from './story-submission.repository';
import { StorySubmissionService } from './story-submission.service';

@Module({
  imports: [PostModule, ImageModule, CategoryModule],
  providers: [StorySubmissionRepository, StorySubmissionService],
  exports: [StorySubmissionRepository, StorySubmissionService],
})
export class StorySubmissionModule {}
