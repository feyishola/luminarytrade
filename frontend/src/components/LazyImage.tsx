import React, { useState, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    placeholderSrc?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, placeholderSrc, alt, ...props }) => {
    const [imgSrc, setImgSrc] = useState(placeholderSrc || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgMSAxIiByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEiIGhlaWdodD0iMSIgZmlsbD0iI2VlZSIvPjwvc3ZnPg==');

    useEffect(() => {
        const img = new Image();
        if (src) {
            img.src = src;
            img.onload = () => {
                setImgSrc(src);
            };
        }
    }, [src]);

    return (
        <img
            {...props}
            src={imgSrc}
            alt={alt}
            loading="lazy"
            style={{
                ...props.style,
                filter: imgSrc === placeholderSrc ? 'blur(10px)' : 'none',
                transition: 'filter 0.3s ease-in-out',
            }}
        />
    );
};

export default LazyImage;
