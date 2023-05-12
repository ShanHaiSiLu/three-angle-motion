# 提供了几个构建 threejs 项目时可能会很有用的有意思的类

## 贝塞尔折线（圆角折线）

&ensp;&ensp;&ensp;&ensp;用来创建一个**圆角曲线**。

&ensp;&ensp;&ensp;&ensp;这个类会创建一个由多个`path`组成的`CurvePath`，它是一个直线(`LineCurve3`)和贝塞尔曲线(`QuadraticBezierCurve3`)组成的`CurvePath`，或者说，是一个拐角圆润的折线，适合用来做物体的运动轨迹曲线，这样既不会得到一个僵硬的折线运动效果，也不会得到一个完全没有一点笔直的运动路径。

当然，你只需要提供这个折线的每个拐点和在拐点的时候你希望的转弯半径就好了。

&ensp;&ensp;&ensp;&ensp;在使用的时候，你会发现除了起点和终点，这个曲线实际上不会经过你传入的任何一个点，这是因为它的创建原理是：**除了起点和终点，其余的点会分别在点的前后根据半径 r 创建*贝塞尔曲线的起点(称为这个点的前连接点)和终点(称为这个点的后连接点)*，而传入的点则会作为*贝塞尔曲线的控制点*，然后从起点开始，起点用直线连接第一个前连接点，然后用贝塞尔曲线借助第一个控制点连接第一个前连接点和第一个后连接点，然后第一个后连接点用直线连接第二个前连接点，然后用贝塞尔曲线借助第二个控制点连接第二个前连接点和第二个后连接点......直到最后一个后连接点，然后最后一个后连接点用直线连接终点**。所以你传入的点中，除了起点和终点，中间的点实际上是起到作为贝塞尔曲线的控制点的作用的。

&ensp;&ensp;&ensp;&ensp;它不存在闭合的概念，所以如果你想创建一个闭合的圆角曲线，可以尝试将某个位于某段直线上的点作为起点和终点（位置重复，但是必须是两个点）。例如，如果你想要将由`(1, 0, 1)`，`(-1, 0, 1)`，`(-1, 0, -1)`，`(1, 0, -1)`这四个点组成的三维直角矩形转化为半径 0.15 的圆角矩形的话，可以使用这几个点：`(1, 0, 0)`，`(1, 0, 1)`，`(-1, 0, 1)`，`(-1, 0, -1)`，`(1, 0, -1)`，`(1, 0, 0)`。当然这只是一种概念上的阐述，具体的应用会在 demo 中展示。

### 构造函数( `BezierPolyline3D` )参数

- pointInfos

  点数组，成员**可以直接是一个点（`THREE.Vector3`）**，也可以是包含点和半径的对象，对象的具体参数如下表：
  | 键名 | 类型 | 默认值 | 备注 |
  | --- | --- | --- | --- |
  | point | `Vector3` | - | 必填，不可为空 |
  | prevR | `Float` | 默认半径 | |
  | nextR | `Float` | 默认半径 | |

- r

  默认半径，当 pointInfos 中没有设定半径的时候，就会使用这个值，，默认值为`1`。

### 代码示例

```js
let r = 1;
let points = [
  new THREE.Vector3(4, 0.01, 3),
  new THREE.Vector3(0, 0, 3),
  {
    point: new THREE.Vector3(-3, 7, 5),
    prevR: 0.3,
    nextR: 1.5,
  },
  {
    point: new THREE.Vector3(0, 6, 3),
    prevR: 0.7,
  }
  new THREE.Vector3(2, 4, 3),
];
let btnPoints = new MiniAngleCurvePath(points, r);
```

### 属性

- `path`

  `CurvePath`实例，包含了全部的直线和曲线

- `r`

  默认半径

- `start`

  起点

- `end`

  终点

- `arr_point`

  所有的点

- `contactPoints`

  除了起点和终点以外的所有点，以及它们计算出的前连接点和后连接点。

- `showPoints`

  前连接点和后连接点

### 方法

- `pushTop`

  在首部压入一个点（更新起点），参数可一个是一个点（`THREE.Vector3`），也可以是一个包含点和半径的对象，具体参数与构造函数参数一中点数组的单个成员为对象时的限制相同。

- `popTop`

  在首部弹出一个点。

- `pushTail`

  在尾部压入一个点（更新终点），参数与`pushTop`方法的参数相同。

- `popTail`

  在尾部弹出一个点。

## 指针锁定轨道控制器

> 暂时仅支持透视相机

顾名思义，这是一个结合了指针控制器和轨道控制器的控制器，在创建第三人称的代码的时候，他可能是一个不错的选择（但是如何结合模型动画以及如何进行物理碰撞需要自己添加额外代码）。

他的工作方式是，会在你执行`lock`方法后锁定你的鼠标，然后在你滑动鼠标的时候让你的摄像机发生相应的变动。

### 构造函数参数

| 参数名       | 数据类型                    | 说明                    | 备注                          |
| ------------ | --------------------------- | ----------------------- | ----------------------------- |
| `object`     | `PerspectiveCamera`实例对象 | 被控制的相机            | **仅支持**透视相机！          |
| `domElement` | `DOM`                       | 监听鼠标事件的 dom 标签 | 推荐使用`renderer.domElement` |
| `target`     | `Vector3`                   | 轨道控制器的中心        |                               |

### 事件

| 事件名   | 触发时机           | 说明         |
| -------- | ------------------ | ------------ |
| `lock`   | 指针锁定时触发     | _无事件参数_ |
| `unlock` | 指针解除锁定时触发 | _无事件参数_ |

### 属性

| 属性名          | 类型                | 默认值      | 说明                 | 备注   |
| --------------- | ------------------- | ----------- | -------------------- | ------ |
| target          | `Vector3`           | -           | 轨道中心             |        |
| object          | `PerspectiveCamera` | -           | 被控制的相机         |        |
| domElement      | `DOM`               | -           | 控制用的 DOM         |        |
| rotateSpeed     | `Float`             | 1.0         | 滑动鼠标时的旋转速度 |        |
| zoomScaleSpeed  | `Float`             | 0.95;       | 滚动滚轮时的缩放速度 |        |
| minDistance     | `Float`             | 0           | 最小半径             |        |
| maxDistance     | `Float`             | `Infinity`  | 最大半径             |        |
| minPolarAngle   | `Float`             | 0           | 垂直最小角度         | 弧度制 |
| maxPolarAngle   | `Float`             | Math.PI     | 垂直最大角度         | 弧度制 |
| minAzimuthAngle | `Float`             | `-Infinity` | 水平最小角度         | 弧度制 |
| maxAzimuthAngle | `Float`             | `Infinity`  | 水平最大角度         | 弧度制 |

### 方法

- `lock`

  锁定指针

- `unlock`

  解锁指针

- `update`

  更新控制器的方法，将鼠标滑动和滚轮滚动产生的变化更新到相机上，根据球坐标偏移更新球坐标，然后更新摄像机的轴坐标

- `getAzimuthalAngle`

  获取水平夹角

## 打点测距
