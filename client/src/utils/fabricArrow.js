import { fabric } from 'fabric';
import { ARROW } from '../constants';

fabric.Arrow = fabric.util.createClass(fabric.Line, {
  type: 'arrow',

  initialize: function(points, options) {
    options = options || {};
    this.callSuper('initialize', points, options);
    this.set('headLength', options.headLength || ARROW.HEAD_LENGTH);
    this.set('headAngle', options.headAngle || ARROW.HEAD_ANGLE);
  },

  _render: function(ctx) {
    ctx.beginPath();

    const p = this.calcLinePoints();
    const xDiff = p.x2 - p.x1;
    const yDiff = p.y2 - p.y1;
    const angle = Math.atan2(yDiff, xDiff);

    const headLength = this.headLength || ARROW.HEAD_LENGTH;
    const headAngle = this.headAngle || ARROW.HEAD_ANGLE;

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
    ctx.strokeStyle = this.stroke || ctx.fillStyle;
    ctx.stroke();
    ctx.strokeStyle = origStrokeStyle;
  },

  toObject: function(propertiesToInclude) {
    return fabric.util.object.extend(this.callSuper('toObject', propertiesToInclude), {
      headLength: this.headLength,
      headAngle: this.headAngle
    });
  }
});

fabric.Arrow.fromObject = function(object, callback) {
  const points = [object.x1, object.y1, object.x2, object.y2];
  callback && callback(new fabric.Arrow(points, object));
};

fabric.Arrow.async = true;

export default fabric.Arrow;
