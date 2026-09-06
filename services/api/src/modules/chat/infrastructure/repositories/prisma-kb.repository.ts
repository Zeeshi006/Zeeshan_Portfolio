import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { IKBRepository } from '../../domain/ports/kb-repository.port';
import { KBDocument } from '../../domain/entities/kb-document.entity';
import { Prisma } from '@prisma/client';

interface KBDocumentRow {
  id: string;
  title: string;
  content: string;
  metadata: unknown;
  published: boolean;
  elevenLabsDocId?: string | null;
}

@Injectable()
export class PrismaKBRepository implements IKBRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<KBDocument[]> {
    const rows = await this.prisma.kBDocument.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(this.toDomain);
  }

  async findById(id: string): Promise<KBDocument | null> {
    const row = await this.prisma.kBDocument.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async create(doc: Omit<KBDocument, 'id'> & { embedding?: number[] }): Promise<KBDocument> {
    const row = await this.prisma.kBDocument.create({
      data: {
        title: doc.title,
        content: doc.content,
        metadata: doc.metadata as Prisma.InputJsonValue,
        published: doc.published,
      },
    });

    // Update embedding via raw query if provided (pgvector unsupported type)
    if (doc.embedding && doc.embedding.length > 0) {
      const vectorStr = `[${doc.embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE kb_documents
        SET embedding = ${vectorStr}::vector
        WHERE id = ${row.id}
      `;
    }

    return this.toDomain(row);
  }

  async update(
    id: string,
    doc: Partial<Omit<KBDocument, 'id'>> & { embedding?: number[]; elevenLabsDocId?: string | null },
  ): Promise<KBDocument> {
    const updateData: Prisma.KBDocumentUpdateInput = {};
    if (doc.title !== undefined) updateData.title = doc.title;
    if (doc.content !== undefined) updateData.content = doc.content;
    if (doc.metadata !== undefined) updateData.metadata = doc.metadata as Prisma.InputJsonValue;
    if (doc.published !== undefined) updateData.published = doc.published;
    if (doc.elevenLabsDocId !== undefined) (updateData as Record<string, unknown>)['elevenLabsDocId'] = doc.elevenLabsDocId;

    const row = await this.prisma.kBDocument.update({
      where: { id },
      data: updateData,
    });

    // Update embedding via raw query if provided
    if (doc.embedding && doc.embedding.length > 0) {
      const vectorStr = `[${doc.embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE kb_documents
        SET embedding = ${vectorStr}::vector
        WHERE id = ${id}
      `;
    }

    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.kBDocument.delete({ where: { id } });
  }

  async similaritySearch(embedding: number[], topK: number): Promise<KBDocument[]> {
    const vectorStr = `[${embedding.join(',')}]`;

    // pgvector cosine distance operator <=>
    const rows = await this.prisma.$queryRaw<KBDocumentRow[]>`
      SELECT id, title, content, metadata, published
      FROM kb_documents
      WHERE embedding IS NOT NULL AND published = true
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${topK}
    `;

    return rows.map(this.toDomain);
  }

  private toDomain(row: KBDocumentRow): KBDocument {
    return new KBDocument(
      row.id,
      row.title,
      row.content,
      (row.metadata as Record<string, unknown>) ?? {},
      row.published,
      (row as { elevenLabsDocId?: string | null }).elevenLabsDocId,
    );
  }
}
