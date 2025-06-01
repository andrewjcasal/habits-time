interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
}

export const ProgressRing = ({ progress, size, strokeWidth, color }: ProgressRingProps) => {
  // Calculate the radius and circumference
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <svg height={size} width={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        stroke="#e5e5e5"
        fill="transparent"
        strokeWidth={strokeWidth}
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      
      {/* Progress circle */}
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{
          transition: 'stroke-dashoffset 0.5s ease'
        }}
      />
      
      {/* Text in the center */}
      <text
        x="50%"
        y="50%"
        dy=".3em"
        textAnchor="middle"
        fontSize={size / 4}
        fontWeight="bold"
        fill={color}
        className="transform rotate-90"
      >
        {progress}%
      </text>
    </svg>
  );
};