import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'positions' })
@Index('idx_positions_device_timestamp', ['device_id', 'timestamp'])
export class PositionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 128 })
  device_id: string;

  @Column({ type: 'varchar', length: 64 })
  provider: string;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lng: number;

  @Column({ type: 'double precision', nullable: true })
  speed: number | null;

  @Column({ type: 'double precision', nullable: true })
  heading: number | null;

  @Column({ type: 'boolean', nullable: true })
  ignition: boolean | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  raw: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
