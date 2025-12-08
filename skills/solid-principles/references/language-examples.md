# Language-Specific SOLID Examples

Complete SOLID principle examples for Java, JavaScript, Go, and Rust.

---

## Java Examples

### Single Responsibility Principle (SRP)

```java
// VIOLATION
public class UserService {
    public void createUser(String name, String email) {
        // Validation
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
        // Database save
        Connection conn = DriverManager.getConnection("jdbc:mysql://...");
        // Email notification
        sendEmail(email, "Welcome!");
        // Logging
        System.out.println("User created: " + name);
    }
}

// CORRECT: Separated responsibilities
public class UserValidator {
    public void validate(String email) {
        if (!email.contains("@")) {
            throw new IllegalArgumentException("Invalid email");
        }
    }
}

public class UserRepository {
    public void save(User user) {
        // Database logic only
    }
}

public class NotificationService {
    public void sendWelcomeEmail(String email) {
        // Email logic only
    }
}

public class UserService {
    private final UserValidator validator;
    private final UserRepository repository;
    private final NotificationService notifier;

    public UserService(UserValidator validator,
                       UserRepository repository,
                       NotificationService notifier) {
        this.validator = validator;
        this.repository = repository;
        this.notifier = notifier;
    }

    public void createUser(User user) {
        validator.validate(user.getEmail());
        repository.save(user);
        notifier.sendWelcomeEmail(user.getEmail());
    }
}
```

### Open-Closed Principle (OCP)

```java
// Interface-based extension
public interface Shape {
    double area();
}

public class Circle implements Shape {
    private double radius;

    public Circle(double radius) {
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }
}

public class Square implements Shape {
    private double side;

    public Square(double side) {
        this.side = side;
    }

    @Override
    public double area() {
        return side * side;
    }
}

// New shape added without modifying AreaCalculator
public class Hexagon implements Shape {
    private double side;

    public Hexagon(double side) {
        this.side = side;
    }

    @Override
    public double area() {
        return (3 * Math.sqrt(3) / 2) * side * side;
    }
}

public class AreaCalculator {
    public double calculateTotalArea(List<Shape> shapes) {
        return shapes.stream()
                    .mapToDouble(Shape::area)
                    .sum();
    }
}
```

### Liskov Substitution Principle (LSP)

```java
// VIOLATION
public class Bird {
    public void fly() {
        System.out.println("Flying...");
    }
}

public class Penguin extends Bird {
    @Override
    public void fly() {
        throw new UnsupportedOperationException("Penguins cannot fly!");
    }
}

// CORRECT: Proper hierarchy
public interface Bird {
    void move();
    void eat();
}

public interface FlyingBird extends Bird {
    void fly();
}

public class Sparrow implements FlyingBird {
    @Override
    public void move() {
        fly();
    }

    @Override
    public void fly() {
        System.out.println("Flying through the air");
    }

    @Override
    public void eat() {
        System.out.println("Eating seeds");
    }
}

public class Penguin implements Bird {
    @Override
    public void move() {
        System.out.println("Swimming in the water");
    }

    @Override
    public void eat() {
        System.out.println("Eating fish");
    }
}
```

### Interface Segregation Principle (ISP)

```java
// VIOLATION: Fat interface
public interface Machine {
    void print();
    void scan();
    void fax();
    void photocopy();
}

public class BasicPrinter implements Machine {
    @Override
    public void print() {
        System.out.println("Printing...");
    }

    @Override
    public void scan() {
        throw new UnsupportedOperationException();
    }

    @Override
    public void fax() {
        throw new UnsupportedOperationException();
    }

    @Override
    public void photocopy() {
        throw new UnsupportedOperationException();
    }
}

// CORRECT: Segregated interfaces
public interface Printable {
    void print();
}

public interface Scannable {
    void scan();
}

public interface Faxable {
    void fax();
}

public class BasicPrinter implements Printable {
    @Override
    public void print() {
        System.out.println("Printing...");
    }
}

public class MultiFunctionPrinter implements Printable, Scannable, Faxable {
    @Override
    public void print() {
        System.out.println("Printing...");
    }

    @Override
    public void scan() {
        System.out.println("Scanning...");
    }

    @Override
    public void fax() {
        System.out.println("Faxing...");
    }
}
```

### Dependency Inversion Principle (DIP)

```java
// VIOLATION
public class OrderService {
    private MySQLDatabase database;

    public OrderService() {
        this.database = new MySQLDatabase();  // Hard-coded!
    }

    public void saveOrder(Order order) {
        database.save(order);
    }
}

// CORRECT: Spring-style dependency injection
public interface OrderRepository {
    void save(Order order);
    Order findById(Long id);
}

@Repository
public class MySQLOrderRepository implements OrderRepository {
    @Override
    public void save(Order order) {
        // MySQL implementation
    }

    @Override
    public Order findById(Long id) {
        // MySQL implementation
        return null;
    }
}

@Service
public class OrderService {
    private final OrderRepository repository;

    @Autowired
    public OrderService(OrderRepository repository) {
        this.repository = repository;  // Injected!
    }

    public void saveOrder(Order order) {
        repository.save(order);
    }
}
```

---

## JavaScript Examples

### Single Responsibility Principle (SRP)

```javascript
// VIOLATION: Multiple responsibilities
class UserAccount {
    constructor(user) {
        this.user = user;
    }

    authenticate(password) {
        // Auth logic
        return this.user.password === password;
    }

    sendEmail(message) {
        // Email logic
        console.log(`Sending to ${this.user.email}: ${message}`);
    }

    saveToDatabase() {
        // Database logic
        console.log('Saving to database...');
    }
}

// CORRECT: Composition-based approach
const createAuthenticator = () => ({
    authenticate: (user, password) => user.password === password
});

const createEmailService = () => ({
    send: (to, message) => {
        console.log(`Sending to ${to}: ${message}`);
    }
});

const createUserRepository = () => ({
    save: (user) => {
        console.log('Saving user to database...');
    }
});

// Usage with composition
const authenticator = createAuthenticator();
const emailService = createEmailService();
const userRepository = createUserRepository();
```

### Open-Closed Principle (OCP)

```javascript
// VIOLATION
function calculateShipping(type, weight) {
    if (type === 'standard') {
        return weight * 2;
    } else if (type === 'express') {
        return weight * 5;
    } else if (type === 'overnight') {
        return weight * 10;
    }
    // Must modify to add new types
    return 0;
}

// CORRECT: Strategy pattern
const shippingStrategies = {
    standard: (weight) => weight * 2,
    express: (weight) => weight * 5,
    overnight: (weight) => weight * 10,
};

// Extensible: just add new strategy
shippingStrategies.international = (weight) => weight * 15;

const calculateShipping = (type, weight) => {
    const strategy = shippingStrategies[type];
    if (!strategy) {
        throw new Error(`Unknown shipping type: ${type}`);
    }
    return strategy(weight);
};

// Or with classes
class ShippingCalculator {
    constructor() {
        this.strategies = new Map();
    }

    registerStrategy(name, calculator) {
        this.strategies.set(name, calculator);
    }

    calculate(type, weight) {
        const strategy = this.strategies.get(type);
        return strategy ? strategy(weight) : 0;
    }
}
```

### Liskov Substitution Principle (LSP)

```javascript
// VIOLATION
class Duck {
    quack() {
        console.log('Quack!');
    }

    fly() {
        console.log('Flying...');
    }
}

class RubberDuck extends Duck {
    fly() {
        throw new Error('Rubber ducks cannot fly!');
    }
}

// CORRECT: Proper abstractions
const createSwimmingBird = (name) => ({
    name,
    swim: () => console.log(`${name} is swimming`),
});

const createFlyingBird = (name) => ({
    ...createSwimmingBird(name),
    fly: () => console.log(`${name} is flying`),
});

const createQuackingToy = (name) => ({
    name,
    quack: () => console.log('Squeak!'),
    float: () => console.log(`${name} is floating`),
});

// All substitutable for their specific purposes
const duck = createFlyingBird('Mallard');
const rubberDuck = createQuackingToy('Rubber Duck');
```

### Interface Segregation Principle (ISP)

```javascript
// VIOLATION: Large class with many methods
class SmartDevice {
    playMusic() { /* ... */ }
    makeCall() { /* ... */ }
    sendText() { /* ... */ }
    takePhoto() { /* ... */ }
    browseWeb() { /* ... */ }
}

// MP3 player forced to have phone features
class MP3Player extends SmartDevice {
    makeCall() {
        throw new Error('Not supported');
    }
    sendText() {
        throw new Error('Not supported');
    }
    takePhoto() {
        throw new Error('Not supported');
    }
    browseWeb() {
        throw new Error('Not supported');
    }
}

// CORRECT: Composable capabilities
const withMusicPlayer = (device) => ({
    ...device,
    playMusic: () => console.log('Playing music...'),
});

const withPhone = (device) => ({
    ...device,
    makeCall: (number) => console.log(`Calling ${number}...`),
    sendText: (number, text) => console.log(`Texting ${number}: ${text}`),
});

const withCamera = (device) => ({
    ...device,
    takePhoto: () => console.log('Taking photo...'),
});

// Compose only what you need
const mp3Player = withMusicPlayer({ name: 'iPod' });
const smartphone = withCamera(withPhone(withMusicPlayer({ name: 'iPhone' })));
```

### Dependency Inversion Principle (DIP)

```javascript
// VIOLATION
class UserService {
    constructor() {
        this.database = new MySQLDatabase();  // Hard-coded!
        this.logger = new ConsoleLogger();    // Hard-coded!
    }

    createUser(userData) {
        this.logger.log('Creating user...');
        this.database.save(userData);
    }
}

// CORRECT: Dependency injection
const createUserService = (database, logger) => ({
    createUser: (userData) => {
        logger.log('Creating user...');
        database.save(userData);
    },
    findUser: (id) => database.findById(id),
});

// Create dependencies
const mysqlDatabase = {
    save: (data) => console.log('Saving to MySQL:', data),
    findById: (id) => ({ id, name: 'John' }),
};

const consoleLogger = {
    log: (message) => console.log(`[LOG] ${message}`),
};

// Inject dependencies
const userService = createUserService(mysqlDatabase, consoleLogger);

// Easy to swap for testing
const mockDatabase = {
    save: jest.fn(),
    findById: jest.fn().mockReturnValue({ id: 1, name: 'Test' }),
};
const testUserService = createUserService(mockDatabase, consoleLogger);
```

---

## Go Examples

### Single Responsibility Principle (SRP)

```go
// VIOLATION: struct does too much
type UserManager struct{}

func (um *UserManager) Validate(email string) error {
    // Validation logic
    return nil
}

func (um *UserManager) Save(user User) error {
    // Database logic
    return nil
}

func (um *UserManager) SendEmail(to, message string) error {
    // Email logic
    return nil
}

// CORRECT: Separated responsibilities
type UserValidator struct{}

func (v *UserValidator) Validate(email string) error {
    if !strings.Contains(email, "@") {
        return errors.New("invalid email")
    }
    return nil
}

type UserRepository struct {
    db *sql.DB
}

func (r *UserRepository) Save(user User) error {
    // Database logic only
    return nil
}

type EmailService struct {
    client SMTPClient
}

func (e *EmailService) Send(to, message string) error {
    // Email logic only
    return nil
}

// Orchestrating service
type UserService struct {
    validator  *UserValidator
    repository *UserRepository
    email      *EmailService
}

func NewUserService(v *UserValidator, r *UserRepository, e *EmailService) *UserService {
    return &UserService{validator: v, repository: r, email: e}
}

func (s *UserService) CreateUser(user User) error {
    if err := s.validator.Validate(user.Email); err != nil {
        return err
    }
    if err := s.repository.Save(user); err != nil {
        return err
    }
    return s.email.Send(user.Email, "Welcome!")
}
```

### Open-Closed Principle (OCP)

```go
// Small, focused interface (Go idiom)
type Shape interface {
    Area() float64
}

type Circle struct {
    Radius float64
}

func (c Circle) Area() float64 {
    return math.Pi * c.Radius * c.Radius
}

type Rectangle struct {
    Width, Height float64
}

func (r Rectangle) Area() float64 {
    return r.Width * r.Height
}

// New shape added without modifying existing code
type Triangle struct {
    Base, Height float64
}

func (t Triangle) Area() float64 {
    return 0.5 * t.Base * t.Height
}

// Calculator works with any Shape
func TotalArea(shapes []Shape) float64 {
    var total float64
    for _, shape := range shapes {
        total += shape.Area()
    }
    return total
}
```

### Liskov Substitution Principle (LSP)

```go
// CORRECT: Proper interfaces from the start
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type ReadWriter interface {
    Reader
    Writer
}

// File implements ReadWriter
type File struct {
    name string
}

func (f *File) Read(p []byte) (int, error) {
    // Read implementation
    return 0, nil
}

func (f *File) Write(p []byte) (int, error) {
    // Write implementation
    return 0, nil
}

// ReadOnlyFile only implements Reader
type ReadOnlyFile struct {
    name string
}

func (f *ReadOnlyFile) Read(p []byte) (int, error) {
    // Read implementation
    return 0, nil
}

// Functions accept appropriate interfaces
func Copy(dst Writer, src Reader) error {
    // Works with any Reader and Writer
    return nil
}

func ReadAll(r Reader) ([]byte, error) {
    // Works with any Reader (File, ReadOnlyFile, etc.)
    return nil, nil
}
```

### Interface Segregation Principle (ISP)

```go
// Go idiom: Small, single-method interfaces
type Saver interface {
    Save(data interface{}) error
}

type Loader interface {
    Load(id string) (interface{}, error)
}

type Deleter interface {
    Delete(id string) error
}

// Composed when needed
type Repository interface {
    Saver
    Loader
    Deleter
}

// Read-only repository
type ReadOnlyRepo struct {
    data map[string]interface{}
}

func (r *ReadOnlyRepo) Load(id string) (interface{}, error) {
    return r.data[id], nil
}

// Full repository
type FullRepo struct {
    data map[string]interface{}
}

func (r *FullRepo) Save(data interface{}) error {
    // Save implementation
    return nil
}

func (r *FullRepo) Load(id string) (interface{}, error) {
    return r.data[id], nil
}

func (r *FullRepo) Delete(id string) error {
    delete(r.data, id)
    return nil
}

// Functions accept minimal interfaces
func ProcessData(loader Loader, id string) error {
    data, err := loader.Load(id)
    // Process...
    return err
}
```

### Dependency Inversion Principle (DIP)

```go
// Define interface at consumer side (Go idiom)
type Database interface {
    Save(data interface{}) error
    Find(id string) (interface{}, error)
}

type Logger interface {
    Log(message string)
}

// Service depends on interfaces
type OrderService struct {
    db     Database
    logger Logger
}

func NewOrderService(db Database, logger Logger) *OrderService {
    return &OrderService{db: db, logger: logger}
}

func (s *OrderService) CreateOrder(order Order) error {
    s.logger.Log("Creating order...")
    return s.db.Save(order)
}

// Concrete implementations
type PostgresDB struct {
    conn *sql.DB
}

func (p *PostgresDB) Save(data interface{}) error {
    // PostgreSQL implementation
    return nil
}

func (p *PostgresDB) Find(id string) (interface{}, error) {
    // PostgreSQL implementation
    return nil, nil
}

type ConsoleLogger struct{}

func (c *ConsoleLogger) Log(message string) {
    fmt.Println(message)
}

// Wire up
func main() {
    db := &PostgresDB{}
    logger := &ConsoleLogger{}
    service := NewOrderService(db, logger)
    service.CreateOrder(Order{})
}
```

---

## Rust Examples

### Single Responsibility Principle (SRP)

```rust
// VIOLATION: struct does too much
struct UserManager {
    db_connection: String,
    smtp_server: String,
}

impl UserManager {
    fn validate_email(&self, email: &str) -> bool { true }
    fn save_to_db(&self, user: &User) -> Result<(), Error> { Ok(()) }
    fn send_email(&self, to: &str, msg: &str) -> Result<(), Error> { Ok(()) }
}

// CORRECT: Separated responsibilities
struct EmailValidator;

impl EmailValidator {
    fn validate(&self, email: &str) -> Result<(), ValidationError> {
        if !email.contains('@') {
            return Err(ValidationError::InvalidEmail);
        }
        Ok(())
    }
}

struct UserRepository {
    db: Database,
}

impl UserRepository {
    fn save(&self, user: &User) -> Result<(), DbError> {
        // Database logic only
        Ok(())
    }
}

struct EmailService {
    smtp: SmtpClient,
}

impl EmailService {
    fn send(&self, to: &str, message: &str) -> Result<(), EmailError> {
        // Email logic only
        Ok(())
    }
}

// Orchestrating service
struct UserService {
    validator: EmailValidator,
    repository: UserRepository,
    email: EmailService,
}

impl UserService {
    fn create_user(&self, user: &User) -> Result<(), UserError> {
        self.validator.validate(&user.email)?;
        self.repository.save(user)?;
        self.email.send(&user.email, "Welcome!")?;
        Ok(())
    }
}
```

### Open-Closed Principle (OCP)

```rust
// Trait for extension
trait Shape {
    fn area(&self) -> f64;
}

struct Circle {
    radius: f64,
}

impl Shape for Circle {
    fn area(&self) -> f64 {
        std::f64::consts::PI * self.radius * self.radius
    }
}

struct Rectangle {
    width: f64,
    height: f64,
}

impl Shape for Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
}

// New shape without modifying existing code
struct Triangle {
    base: f64,
    height: f64,
}

impl Shape for Triangle {
    fn area(&self) -> f64 {
        0.5 * self.base * self.height
    }
}

// Works with any Shape
fn total_area(shapes: &[Box<dyn Shape>]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

// Or with generics (monomorphization)
fn total_area_generic<T: Shape>(shapes: &[T]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}
```

### Liskov Substitution Principle (LSP)

```rust
// CORRECT: Proper trait hierarchy
trait Bird {
    fn eat(&self);
    fn move_around(&self);
}

trait FlyingBird: Bird {
    fn fly(&self);
}

struct Sparrow;

impl Bird for Sparrow {
    fn eat(&self) {
        println!("Sparrow eating seeds");
    }

    fn move_around(&self) {
        self.fly();
    }
}

impl FlyingBird for Sparrow {
    fn fly(&self) {
        println!("Sparrow flying");
    }
}

struct Penguin;

impl Bird for Penguin {
    fn eat(&self) {
        println!("Penguin eating fish");
    }

    fn move_around(&self) {
        println!("Penguin swimming");
    }
}

// Functions use appropriate traits
fn feed_bird(bird: &dyn Bird) {
    bird.eat();
}

fn fly_bird(bird: &dyn FlyingBird) {
    bird.fly();
}
```

### Interface Segregation Principle (ISP)

```rust
// Small, focused traits
trait Readable {
    fn read(&self) -> Result<Vec<u8>, Error>;
}

trait Writable {
    fn write(&mut self, data: &[u8]) -> Result<(), Error>;
}

trait Deletable {
    fn delete(&mut self) -> Result<(), Error>;
}

// Composed for full functionality
trait FullStorage: Readable + Writable + Deletable {}

// Implement only what's needed
struct ReadOnlyFile {
    path: String,
}

impl Readable for ReadOnlyFile {
    fn read(&self) -> Result<Vec<u8>, Error> {
        // Read-only implementation
        Ok(vec![])
    }
}

struct FullFile {
    path: String,
}

impl Readable for FullFile {
    fn read(&self) -> Result<Vec<u8>, Error> { Ok(vec![]) }
}

impl Writable for FullFile {
    fn write(&mut self, data: &[u8]) -> Result<(), Error> { Ok(()) }
}

impl Deletable for FullFile {
    fn delete(&mut self) -> Result<(), Error> { Ok(()) }
}

// Functions accept minimal traits
fn read_data(source: &dyn Readable) -> Result<Vec<u8>, Error> {
    source.read()
}
```

### Dependency Inversion Principle (DIP)

```rust
// Define abstractions
trait Database {
    fn save(&self, data: &str) -> Result<(), DbError>;
    fn find(&self, id: &str) -> Result<String, DbError>;
}

trait Logger {
    fn log(&self, message: &str);
}

// Service depends on traits
struct OrderService<D: Database, L: Logger> {
    db: D,
    logger: L,
}

impl<D: Database, L: Logger> OrderService<D, L> {
    fn new(db: D, logger: L) -> Self {
        Self { db, logger }
    }

    fn create_order(&self, order: &str) -> Result<(), OrderError> {
        self.logger.log("Creating order...");
        self.db.save(order)?;
        Ok(())
    }
}

// Concrete implementations
struct PostgresDb {
    connection: String,
}

impl Database for PostgresDb {
    fn save(&self, data: &str) -> Result<(), DbError> { Ok(()) }
    fn find(&self, id: &str) -> Result<String, DbError> { Ok(String::new()) }
}

struct ConsoleLogger;

impl Logger for ConsoleLogger {
    fn log(&self, message: &str) {
        println!("{}", message);
    }
}

// Wire up
fn main() {
    let db = PostgresDb { connection: String::from("...") };
    let logger = ConsoleLogger;
    let service = OrderService::new(db, logger);
    service.create_order("order123").unwrap();
}

// Easy to test with mocks
#[cfg(test)]
mod tests {
    struct MockDb;
    impl Database for MockDb {
        fn save(&self, _: &str) -> Result<(), DbError> { Ok(()) }
        fn find(&self, _: &str) -> Result<String, DbError> { Ok(String::new()) }
    }

    struct MockLogger;
    impl Logger for MockLogger {
        fn log(&self, _: &str) {}
    }

    #[test]
    fn test_create_order() {
        let service = OrderService::new(MockDb, MockLogger);
        assert!(service.create_order("test").is_ok());
    }
}
```
