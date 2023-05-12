import { CurvePath, LineCurve3, QuadraticBezierCurve3, Vector3 } from "three";

export class BezierPolyline3D {
  // 静态变量，path
  path = new CurvePath();
  // 半径
  r;
  // 起点
  start;
  // 终点
  end;
  // 映射出的全部点
  arr_point = [];
  //映射出的全部半径
  arr_prev_r = [];
  arr_next_r = [];
  // 控制点（原始点）和其映射出的接触点
  contactPoints = [];
  // 控制点们映射出的接触点们
  showPoints = [];

  /**
   * @param { [{point,prevR,nextR} || point] } points 点的数组
   * @param { FLOAT } r 默认半径
   */
  constructor(pointInfos, r = 1) {
    if (pointInfos.length < 2) {
      console.error("point num error!");
    }
    // 记录默认半径
    this.r = r;
    // 映射出点和半径数组
    pointInfos.forEach(item => {
      this.arr_point.push(item.point || item);
      this.arr_prev_r.push(item.prevR || r);
      this.arr_next_r.push(item.nextR || r);
    });
    // 取出起点和终点
    this.start = this.arr_point[0];
    this.end = this.arr_point[this.arr_point.length - 1];

    // 需要特别注意的是，如果只有两个点的话，直接压入一条直线路径
    if (this.arr_point.length === 2) {
      this.path.add(new LineCurve3(this.start, this.end));
      return;
    }

    // 将剩余的控制点映射为接触点
    let prev, next;
    let vecP, vecN;
    let surplusArr = this.arr_point.slice(1, -1);
    this.contactPoints = surplusArr.map((point, i) => {
      // 找到当前点的上一个点和下一个点
      prev = !i ? this.start : surplusArr[i - 1];
      next = i + 1 === surplusArr.length ? this.end : surplusArr[i + 1];

      // 找到当前点和上/下一个点的单位向量，并将单位向量的长度翻倍为r倍（向量 * 标量）
      vecP = new Vector3().subVectors(prev, point).normalize();
      vecP.multiplyScalar(this.arr_prev_r[i + 1]);
      vecN = new Vector3().subVectors(next, point).normalize();
      vecN.multiplyScalar(this.arr_next_r[i + 1]);

      // 用当前点和单位向量做运算，得到对应的接触点，同时保留原始点用作贝塞尔曲线的控制点
      return {
        pp: point.clone().add(vecP), // pp -> prevPoint
        np: point.clone().add(vecN), // np -> nextPoint
        p: point,
      };
    });

    // 记录每个点的两个接触点
    this.showPoints = this.contactPoints.map(i => [i.pp, i.np]);

    // 按照原始点和接触点生成path并加入到this.path中
    this.contactPoints.forEach((item, i) => {
      if (!i) {
        // 第一个点的话还需要额外连接起始点
        this.path.add(new LineCurve3(this.start, item.pp));
      }

      // 通过每个点的两个接触点和一个原始点创建一个三维二次贝塞尔曲线
      this.path.add(new QuadraticBezierCurve3(item.pp, item.p, item.np));

      // 每个点都需要主动连接下一个点，最后一个点连接终点
      let nextLinePoint =
        i === this.contactPoints.length - 1 ? this.end : this.contactPoints[i + 1].pp;
      this.path.add(new LineCurve3(item.np, nextLinePoint));
    });
  }

  /**
   * 在首部压入一个点（更新起点）
   * @param { {point,prevR,nextR} || Point }
   */
  pushTop(_point) {
    let point = _point.point || _point,
      prevR = _point.prevR || this.r,
      nextR = _point.nextR || this.r;

    this.arr_point.unshift(point);
    this.arr_prev_r.unshift(prevR);
    this.arr_next_r.unshift(nextR);

    // 原本只有一个点的特殊情况处理
    // 正常情况下，最少都会有两个点，这个一般不会触发
    if (!this.start.distanceTo(this.end)) {
      this.start = point;
      this.path.curves = [new LineCurve3(this.start, this.end)];

      return;
    }
    // 判定是不是之前仅有两个点
    let isTwoPoint = !this.contactPoints.length;

    // 记录原起点，称为【原起点】
    let prevStart = this.start;
    // 更新起点，称为【新起点】
    this.start = point;
    // 记录原第一个映射出控制点的原始点，也就是要和原起点连接的点，称为【原第一控制点】
    let next = isTwoPoint ? this.end : this.contactPoints[0].p;
    // 记录原第一控制点演化出的两个连接点中靠前的一个
    let prevContactPoint = isTwoPoint ? null : this.contactPoints[0].pp;

    // 原起点映射为一个原始点和两个控制点组成的对象，并压入this.contactPoints首部
    // 找到原起点和新起点、原第一控制点之间的单位向量并翻倍为r倍
    let vecP = new Vector3().subVectors(this.start, prevStart).normalize().multiplyScalar(prevR);
    let vecN = new Vector3().subVectors(next, prevStart).normalize().multiplyScalar(nextR);

    let pointMap = {
      pp: prevStart.clone().add(vecP),
      np: prevStart.clone().add(vecN),
      p: prevStart,
    };
    this.contactPoints.unshift(pointMap);

    // 更新接触点记录
    this.showPoints.unshift([pointMap.pp, pointMap.np]);

    // 弹出原本的路径一
    this.path.curves.shift();
    // 压入原起点生成的【后控制点】与原第一控制点的前控制点直接连接的直线
    this.path.curves.unshift(new LineCurve3(pointMap.np, prevContactPoint || this.end));
    // 压入两个新控制点和原起点生成的三维二次贝塞尔曲线
    this.path.curves.unshift(new QuadraticBezierCurve3(pointMap.pp, pointMap.p, pointMap.np));
    // 压入原起点生成的【前控制点】与新起点直接连接的直线
    this.path.curves.unshift(new LineCurve3(this.start, pointMap.pp));
  }

  /**
   * 在首部弹出一个点（起点后移）
   */
  popTop() {
    this.arr_point.shift();
    this.arr_prev_r.shift();
    this.arr_next_r.shift();

    if (this.contactPoints.length === 1) {
      // 只有三个点（起点终点加一个控制点），删除之后变成直接连接起点和终点的直线
      this.start = this.contactPoints.shift().p;
      this.showPoints.shift();
      this.path.curves.length = 0;

      this.path.curves.unshift(new LineCurve3(this.start, this.end));
      return;
    }
    if (this.contactPoints.length === 0) {
      // 只有两个点或者一个点，删除之后变成唯一点（实际上是做成连接两个同位置点(终点到终点)的直线）
      // 不允许删除
      return new Error("不能低于两个点！");
    }
    // 弹出控制点和原始点的对象数组的第一项，这个点将作为作为新起点使用
    let contact1 = this.contactPoints.shift();

    // 更新起点，新起点为原第一控制点
    this.start = contact1.p;

    // 弹出接触点记录的首项
    this.showPoints.shift();

    /**
     * 弹出收到影响的三条路径（也就是路径记录中的前三条路径）：
     * 1、原起点到原第一控制点的前接触点的直线
     * 2、原第一控制点和其两个接触点生成的曲线
     * 3、原第一控制点的后接触点到原第二控制点的前接触点间的直线
     */
    this.path.curves.shift();
    this.path.curves.shift();
    this.path.curves.shift();

    // 加入新路径：原第一控制点（新起点）到原第二控制点（新第一控制点）的前接触点间的直线
    this.path.curves.unshift(new LineCurve3(this.start, this.contactPoints[0].pp));
  }

  /**
   * 在尾部压入一个点（更新终点）
   * @param { {point,prevR,nextR} || Point }
   */
  pushTail(_point) {
    let point = _point.point || _point,
      prevR = _point.prevR || this.r,
      nextR = _point.nextR || this.r;

    this.arr_point.push(point);
    this.arr_prev_r.push(prevR);
    this.arr_next_r.push(nextR);

    // 原本只有一个点情况特殊处理
    if (this.start === this.end) {
      this.end = point;
      this.path.curves = [new LineCurve3(this.start, this.end)];

      return;
    }
    // 判定是不是之前仅有两个点
    let isTwoPoint = !this.contactPoints.length;

    // 记录原终点，成为【原终点】
    let prevEnd = this.end;
    // 更新终点，称为【新终点】
    this.end = point;
    // 记录原最后一个映射出控制点的原始点，也就是要和原终点连接的点，称为【原末位控制点】
    let lastBackP = isTwoPoint ? this.start : this.contactPoints[this.contactPoints.length - 1].p;
    // 记录原末位控制点演化出的两个连接点中靠后的一个
    let lastContact = isTwoPoint ? null : this.contactPoints[this.contactPoints.length - 1].np;

    // 原终点映射为一个原始点和两个控制点组成的对象，并压入this.contactPoints尾部
    // 找到原终点和新终点、原末位控制点之间的单位向量并翻倍为r倍
    let vecP = new Vector3().subVectors(lastBackP, prevEnd).normalize().multiplyScalar(prevR);
    let vecN = new Vector3().subVectors(this.end, prevEnd).normalize().multiplyScalar(nextR);

    let pointMap = {
      pp: prevEnd.clone().add(vecP),
      np: prevEnd.clone().add(vecN),
      p: prevEnd,
    };
    this.contactPoints.push(pointMap);

    // 更新接触点记录
    this.showPoints.push([pointMap.pp, pointMap.np]);

    // 弹出原本的末位路径一
    this.path.curves.pop();

    // 压入原末位控制点的后控制点与原终点生成的【前控制点】直接连接的直线
    this.path.curves.push(new LineCurve3(lastContact || this.start, pointMap.pp));
    // 压入两个新控制点和原终点生成的三维二次贝塞尔曲线
    this.path.curves.push(new QuadraticBezierCurve3(pointMap.pp, pointMap.p, pointMap.np));

    // 压入原终点生成的【后控制点】与新终点直接连接的直线
    this.path.curves.push(new LineCurve3(pointMap.np, this.end));
  }

  /**
   * 在尾部弹出一个点（终点前移）
   */
  popTail() {
    this.arr_point.pop();
    this.arr_prev_r.pop();
    this.arr_next_r.pop();

    if (this.contactPoints.length === 1) {
      // 只有三个点（起点终点加一个控制点），删除之后变成直接连接起点和终点的直线
      this.end = this.contactPoints.shift().p;
      this.showPoints.shift();
      this.path.curves.length = 0;

      this.path.curves.unshift(new LineCurve3(this.start, this.end));
      return;
    }
    if (this.contactPoints.length === 0) {
      // 只有两个点或者一个点，删除之后变成唯一点（实际上是做成连接两个同位置点(终点到终点)的直线）
      // 不允许删除
      return new Error("不能低于两个点！");
    }

    // 弹出控制点和原始点的对象数组的末项，这个点将作为作为新终点使用
    let contactTail = this.contactPoints.pop();

    // 更新终点，新终点为原末位控制点
    this.end = contactTail.p;

    // 弹出接触点记录的末项
    this.showPoints.pop();

    /**
     * 弹出收到影响的三条路径（也就是路径记录中的后三条路径）：
     * 1、原第二末位控制点的后接触点到原末位控制点的前接触点间的直线
     * 2、原末位控制点和其两个接触点生成的曲线
     * 1、原末位控制点的后接触点到原终点的直线
     */
    this.path.curves.pop();
    this.path.curves.pop();
    this.path.curves.pop();

    // 加入新路径：原第二末位控制点（新末位控制点）的后接触点到原末位控制点（新终点）间的直线
    this.path.curves.push(
      new LineCurve3(this.contactPoints[this.contactPoints.length - 1].np, this.end),
    );
  }
}
