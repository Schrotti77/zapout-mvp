# ZapOut UI Components - Quick Reference

## CSS Classes & Styles

### Buttons

```jsx
// Primary (Bitcoin Orange)
<button style={{
  background: 'linear-gradient(135deg, #f7931a 0%, #e5820a 100%)',
  color: '#000000',
  border: 'none',
  borderRadius: '12px',
  padding: '14px 24px',
  fontSize: '15px',
  fontWeight: '600',
  width: '100%',
  boxShadow: '0 4px 12px rgba(247, 147, 26, 0.3)',
  cursor: 'pointer'
}}>Text</button>

// Secondary (Dark)
<button style={{
  backgroundColor: '#1f1f1f',
  color: '#ffffff',
  border: '1px solid #333333',
  borderRadius: '12px',
  padding: '14px 24px',
  width: '100%'
}}>Text</button>
```

### Input Fields

```jsx
<input
  style={{
    width: '100%',
    padding: '14px 16px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '16px',
    outline: 'none',
  }}
  placeholder="Text..."
/>
```

### Cards

```jsx
<div
  style={{
    backgroundColor: '#141414',
    border: '1px solid #222222',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
  }}
>
  Content
</div>
```

### Badges

```jsx
// Success
<span style={{
  backgroundColor: 'rgba(34, 197, 94, 0.15)',
  color: '#22c55e',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '12px'
}}>Text</span>

// Warning
<span style={{
  backgroundColor: 'rgba(245, 158, 11, 0.15)',
  color: '#f59e0b',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '12px'
}}>Text</span>

// Error
<span style={{
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  color: '#ef4444',
  padding: '4px 10px',
  borderRadius: '20px',
  fontSize: '12px'
}}>Text</span>
```

### Quick Amount Buttons

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
  <button
    style={{
      backgroundColor: '#1f1f1f',
      color: '#ffffff',
      border: '1px solid #2a2a2a',
      padding: '12px',
      borderRadius: '10px',
      fontSize: '14px',
    }}
  >
    10€
  </button>
</div>
```

### Page Title

```jsx
<h2
  style={{
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '20px',
  }}
>
  Title
</h2>
```

### Section Title

```jsx
<h3
  style={{
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '24px',
    marginBottom: '12px',
  }}
>
  Title
</h3>
```

---

## Farben (Quick Reference)

| Element        | Hex       |
| -------------- | --------- |
| Primary        | `#f7931a` |
| Background     | `#0a0a0a` |
| Surface        | `#141414` |
| Surface Light  | `#1f1f1f` |
| Border         | `#222222` |
| Border Light   | `#2a2a2a` |
| Text           | `#ffffff` |
| Text Secondary | `#c0c0c0` |
| Text Muted     | `#666666` |
| Success        | `#22c55e` |
| Warning        | `#f59e0b` |
| Error          | `#ef4444` |

---

_2026-03-17_
