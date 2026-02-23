const Error500 = () => (
  <div>
    <h1>500 - Server Error</h1>
    <button onClick={() => window.location.reload()}>
      Retry
    </button>
  </div>
);

export default Error500;