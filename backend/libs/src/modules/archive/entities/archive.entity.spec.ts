import { ArchiveType } from '@prisma/client';
import { redactMemberOnly } from './archive.entity';

describe('redactMemberOnly', () => {
  const member = {
    type: ArchiveType.MEMBER,
    externalLinks: ['https://example.org/paper'],
    documents: [{ id: 'doc-1' }],
  };

  it('MEMBER + canViewPrivate=false → externalLinks & documents null', () => {
    expect(redactMemberOnly(member, false)).toEqual({
      type: ArchiveType.MEMBER,
      externalLinks: null,
      documents: null,
    });
  });

  it('MEMBER + canViewPrivate=true → unchanged', () => {
    expect(redactMemberOnly(member, true)).toEqual(member);
  });

  it('MEMBER + active member (caller passes canViewPrivate || isMember = true) → unchanged', () => {
    const accessibleAsMember = false || true; // non-moderator + membership aktif
    expect(redactMemberOnly(member, accessibleAsMember)).toEqual(member);
  });

  it('PUBLIC + canViewPrivate=false → unchanged', () => {
    const publicArchive = { ...member, type: ArchiveType.PUBLIC };
    expect(redactMemberOnly(publicArchive, false)).toEqual(publicArchive);
  });

  it('list item (no documents) → only externalLinks nulled', () => {
    const listItem = { type: ArchiveType.MEMBER, externalLinks: ['https://example.org/paper'] };
    expect(redactMemberOnly(listItem, false)).toEqual({
      type: ArchiveType.MEMBER,
      externalLinks: null,
    });
  });
});
