import { Line, classRegistry } from 'fabric';
import type { TOptions, Abortable } from 'fabric';
import type { FabricObjectProps, SerializedObjectProps } from 'fabric';
import type { ObjectEvents } from 'fabric';
import { ARROW } from '../constants';

interface UniqueArrowProps {
  headLength: number;
  headAngle: number;
}

interface SerializedArrowProps extends SerializedObjectProps, UniqueArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ArrowProps extends FabricObjectProps, UniqueArrowProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class Arrow<
  Props extends TOptions<ArrowProps> = Partial<ArrowProps>,
  SProps extends SerializedArrowProps = SerializedArrowProps,
  EventSpec extends ObjectEvents = ObjectEvents
> extends Line<Props, SProps, EventSpec> implements UniqueArrowProps {

  static type = 'Arrow';

  get type(): string {
    return 'arrow';
  }

  declare headLength: number;
  declare headAngle: number;

  static cacheProperties = [...Line.cacheProperties, 'headLength', 'headAngle'];

  constructor(
    points: [number, number, number, number] = [0, 0, 0, 0],
    options?: Partial<Props>
  ) {
    super(points, options);
    this.headLength = (options as Partial<ArrowProps>)?.headLength ?? ARROW.HEAD_LENGTH;
    this.headAngle = (options as Partial<ArrowProps>)?.headAngle ?? ARROW.HEAD_ANGLE;
  }

  _render(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath();

    const p = this.calcLinePoints();
    const xDiff = p.x2 - p.x1;
    const yDiff = p.y2 - p.y1;
    const angle = Math.atan2(yDiff, xDiff);

    const headLength = this.headLength ?? ARROW.HEAD_LENGTH;
    const headAngle = this.headAngle ?? ARROW.HEAD_ANGLE;

    ctx.moveTo(p.x1, p.y1);
    ctx.lineTo(p.x2, p.y2);

    ctx.moveTo(p.x2, p.y2);
    ctx.lineTo(
      p.x2 - headLength * Math.cos(angle - headAngle),
      p.y2 - headLength * Math.sin(angle - headAngle)
    );

    ctx.moveTo(p.x2, p.y2);
    ctx.lineTo(
      p.x2 - headLength * Math.cos(angle + headAngle),
      p.y2 - headLength * Math.sin(angle + headAngle)
    );

    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = this.strokeLineCap;
    ctx.lineJoin = 'miter';

    const origStrokeStyle = ctx.strokeStyle;
    ctx.strokeStyle = this.stroke?.toString() ?? ctx.fillStyle;
    ctx.stroke();
    ctx.strokeStyle = origStrokeStyle;
  }

  // @ts-expect-error Fabric.js generic typing incompatible with subclass toObject override (issue #10196)
  toObject(propertiesToInclude?: string[]): SerializedArrowProps {
    const extra = [...(propertiesToInclude || []), 'headLength', 'headAngle'] as never[];
    return super.toObject(extra) as unknown as SerializedArrowProps;
  }

  static async fromObject<T extends TOptions<SerializedArrowProps>>(
    object: T,
    _options?: Abortable
  ): Promise<Arrow> {
    const { x1 = 0, y1 = 0, x2 = 0, y2 = 0, ...rest } = object;
    const points: [number, number, number, number] = [x1, y1, x2, y2];
    return new Arrow(points, rest as Partial<ArrowProps>);
  }
}

classRegistry.setClass(Arrow);
classRegistry.setClass(Arrow, 'arrow');
